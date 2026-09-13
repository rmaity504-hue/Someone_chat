import { WebSocket } from 'ws';
import { db } from './db.js';
import { MatchSession, ChatMessage } from '../src/types.js';
import { SafetyEvaluation, sanitizeOffPlatformContent } from './safety.js';
import crypto from 'crypto';
import { simulator, BOT_USER_ID, BOT_NAME } from './simulator.js';

export interface ConnectedClient {
  userId: string;
  ws: WebSocket;
  lastHeartbeat: number;
}

export interface WaitingUser {
  userId: string;
  joinedAt: number;
  isVolunteer: boolean;
  topics?: string[];
}

// Configured matching duration thresholds
export const TOPIC_FALLBACK_THRESHOLD_MS = 7000; // 7 seconds before matching without overlapping topics
export const VOLUNTEER_FALLBACK_THRESHOLD_MS = 45000; // 45 seconds waiting before volunteer fallback
export const NO_ONE_AVAILABLE_THRESHOLD_MS = 75000; // 75 seconds total before showing calm "No one available right now"

export class Matchmaker {
  private clients: Map<string, ConnectedClient> = new Map(); // userId -> ConnectedClient
  private waitingPool: Map<string, WaitingUser> = new Map(); // userId -> WaitingUser
  private activeSessions: Map<string, MatchSession> = new Map(); // roomId -> MatchSession
  private userToRoom: Map<string, string> = new Map(); // userId -> roomId
  private volunteerOffers: Map<string, { volunteerId: string; waitingUserId: string; createdAt: number }> = new Map();

  constructor() {
    // Periodic check for matching & volunteer fallback & heartbeat cleanup
    setInterval(() => this.tick(), 2000);
  }

  registerClient(userId: string, ws: WebSocket) {
    this.clients.set(userId, {
      userId,
      ws,
      lastHeartbeat: Date.now(),
    });

    const user = db.getUserById(userId);
    if (user && user.status === 'offline') {
      db.updateUser(userId, { status: user.volunteerActive ? 'volunteer_available' : 'offline' });
    }
  }

  unregisterClient(userId: string, closingWs?: WebSocket) {
    const existing = this.clients.get(userId);
    if (closingWs && existing && existing.ws !== closingWs) {
      // A new socket connection has already been established by this user
      return;
    }
    this.clients.delete(userId);
    this.leaveMatching(userId);
    this.handleUserDisconnect(userId);
    db.updateUser(userId, { status: 'offline' });
  }

  /**
   * Immediately close active WebSockets for a restricted, suspended, or banned user.
   */
  closeUserSockets(userId: string, reason?: string) {
    const c = this.clients.get(userId);
    if (c) {
      try {
        if (c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(
            JSON.stringify({
              event: 'account:restricted',
              data: { reason: reason || 'Account restricted or suspended.' },
            })
          );
          c.ws.close(4003, reason || 'Account restricted');
        } else {
          c.ws.terminate();
        }
      } catch (err) {
        console.error(`Error closing socket for restricted user ${userId}:`, err);
      }
      this.unregisterClient(userId);
    }
  }

  updateHeartbeat(userId: string) {
    const c = this.clients.get(userId);
    if (c) {
      c.lastHeartbeat = Date.now();
    }
  }

  sendToUser(userId: string, event: string, payload: any) {
    const c = this.clients.get(userId);
    if (c && c.ws.readyState === WebSocket.OPEN) {
      try {
        c.ws.send(JSON.stringify({ event, data: payload }));
      } catch (err) {
        console.error(`Failed to send to user ${userId}:`, err);
      }
    }
  }

  // User enters matching pool
  enterMatching(userId: string, rawTopics?: string[]): { success: boolean; message?: string } {
    const user = db.getUserById(userId);
    if (!user) return { success: false, message: 'User not found' };

    if (!user.safetyAcknowledged) {
      return { success: false, message: 'Please review and acknowledge the safety notice.' };
    }

    const restriction = db.isUserSuspendedOrBanned(userId);
    if (restriction.isRestricted) {
      return { success: false, message: restriction.reason || 'Account is currently suspended or restricted.' };
    }

    // Leave any current room or waiting state first
    this.leaveMatching(userId);

    const sanitizedTopics = Array.isArray(rawTopics)
      ? rawTopics
          .filter((t) => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim().toLowerCase().slice(0, 30))
          .filter((t, i, arr) => arr.indexOf(t) === i)
          .slice(0, 3)
      : [];

    this.waitingPool.set(userId, {
      userId,
      joinedAt: Date.now(),
      isVolunteer: false,
      topics: sanitizedTopics,
    });
    console.log(`[Matchmaker] User joined pool: ${userId}, topics: [${sanitizedTopics.join(', ')}]`);

    db.updateUser(userId, { status: 'matching' });
    this.sendToUser(userId, 'matching:state', { state: 'searching', message: "Finding someone who's available..." });

    // Try immediate match
    this.tryMatch(userId);
    return { success: true };
  }

  leaveMatching(userId: string) {
    if (this.waitingPool.has(userId)) {
      this.waitingPool.delete(userId);
      const user = db.getUserById(userId);
      if (user && user.status === 'matching') {
        db.updateUser(userId, { status: 'offline' });
      }
      this.sendToUser(userId, 'matching:state', { state: 'idle' });
    }

    // Clear any pending volunteer offer
    for (const [offerId, offer] of this.volunteerOffers.entries()) {
      if (offer.waitingUserId === userId || offer.volunteerId === userId) {
        this.volunteerOffers.delete(offerId);
        this.sendToUser(offer.waitingUserId, 'matching:state', { state: 'idle' });
      }
    }
  }

  // Periodic matchmaker tick
  private tick() {
    const now = Date.now();

    // Clean stale clients (no heartbeat for 40s)
    for (const [userId, client] of this.clients.entries()) {
      if (now - client.lastHeartbeat > 40000) {
        try {
          client.ws.terminate();
        } catch {}
        this.unregisterClient(userId);
      }
    }

    // Process waiting users
    for (const [userId, waiting] of Array.from(this.waitingPool.entries())) {
      if (!this.clients.has(userId)) {
        this.waitingPool.delete(userId);
        continue;
      }

      // Try normal match first
      const matched = this.tryMatch(userId);
      if (matched) continue;

      const waitingDuration = now - waiting.joinedAt;

      // Configured threshold: if user remains in matching beyond 45 seconds, prompt or pair with an available volunteer listener
      if (waitingDuration >= VOLUNTEER_FALLBACK_THRESHOLD_MS && waitingDuration < NO_ONE_AVAILABLE_THRESHOLD_MS) {
        this.checkVolunteerFallback(userId);
      } else if (waitingDuration >= NO_ONE_AVAILABLE_THRESHOLD_MS) {
        // Show calm "No one is available right now." allowing them to remain available or leave
        this.sendToUser(userId, 'matching:state', {
          state: 'no_one_available',
          message: 'No one is available right now.',
          canStay: true,
        });
      }
    }
  }

  stayAvailableInPool(userId: string) {
    const waiting = this.waitingPool.get(userId);
    if (waiting) {
      waiting.joinedAt = Date.now();
    } else {
      this.enterMatching(userId);
      return;
    }
    this.sendToUser(userId, 'matching:state', {
      state: 'searching',
      message: "Finding someone who's available...",
    });
  }

  private tryMatch(userId: string): boolean {
    const userA = db.getUserById(userId);
    const waitingA = this.waitingPool.get(userId);
    if (!userA || !waitingA) return false;

    const now = Date.now();
    const waitTimeA = now - waitingA.joinedAt;
    const fallbackA = waitTimeA >= TOPIC_FALLBACK_THRESHOLD_MS;
    const topicsA = waitingA.topics || [];

    interface Candidate {
      userId: string;
      overlapCount: number;
      overlappingTopics: string[];
      waitTime: number;
    }

    const eligibleCandidates: Candidate[] = [];

    // Search for another waiting user who isn't userA
    for (const [otherId, waitingB] of this.waitingPool.entries()) {
      if (otherId === userId) continue;
      const userB = db.getUserById(otherId);
      if (!userB) continue;

      // Check blocks
      if (db.isBlockedEitherWay(userId, otherId)) continue;

      // Avoid recently disconnected pairs (last 2)
      if (userA.recentPartnerIds?.includes(otherId) || userB.recentPartnerIds?.includes(userId)) {
        continue;
      }

      const waitTimeB = now - waitingB.joinedAt;
      const fallbackB = waitTimeB >= TOPIC_FALLBACK_THRESHOLD_MS;
      const topicsB = waitingB.topics || [];

      // Calculate topic overlap
      const overlapping = topicsA.filter((t) => topicsB.includes(t));
      const overlapCount = overlapping.length;

      // Topic Matchmaking Logic:
      // 1. If both users share overlapping topics -> always eligible!
      // 2. If neither user specified topics -> always eligible!
      // 3. Fallback: If either waiting duration >= 7 seconds -> fallback eligible for any user!
      // 4. If user A has waited >= 7s or has no topics and candidate has waited >= 7s -> eligible!
      const canMatch =
        overlapCount > 0 ||
        (topicsA.length === 0 && topicsB.length === 0) ||
        fallbackA ||
        fallbackB;

      if (canMatch) {
        eligibleCandidates.push({
          userId: otherId,
          overlapCount,
          overlappingTopics: overlapping,
          waitTime: waitTimeB,
        });
      }
    }

    if (eligibleCandidates.length === 0) return false;

    // Prioritize candidates:
    // 1. Highest topic overlap count
    // 2. Longest wait time
    eligibleCandidates.sort((a, b) => {
      if (b.overlapCount !== a.overlapCount) {
        return b.overlapCount - a.overlapCount;
      }
      return b.waitTime - a.waitTime;
    });

    const chosen = eligibleCandidates[0];

    // Remove both from pool
    this.waitingPool.delete(userId);
    this.waitingPool.delete(chosen.userId);

    this.createPendingSession(userA.id, chosen.userId, false, chosen.overlappingTopics);
    return true;
  }

  private checkVolunteerFallback(waitingUserId: string) {
    // Check if already in an offer
    for (const offer of this.volunteerOffers.values()) {
      if (offer.waitingUserId === waitingUserId) return;
    }

    // Find a volunteer who is active, connected, and not in a call/waiting
    const allUsers = db.getAllUsersList();
    const availableVolunteers = allUsers.filter(u => {
      return (
        u.isVolunteer &&
        u.volunteerActive &&
        u.id !== waitingUserId &&
        this.clients.has(u.id) &&
        !this.userToRoom.has(u.id) &&
        !this.waitingPool.has(u.id) &&
        !db.isBlockedEitherWay(u.id, waitingUserId)
      );
    });

    if (availableVolunteers.length === 0) return;

    // Pick first available volunteer
    const volunteer = availableVolunteers[0];
    const offerId = 'off_' + crypto.randomBytes(6).toString('hex');

    this.volunteerOffers.set(offerId, {
      offerId,
      volunteerId: volunteer.id,
      waitingUserId,
      createdAt: Date.now(),
    } as any);

    // Notify volunteer: "Someone is waiting to talk." with "Connect" and "Not now"
    this.sendToUser(volunteer.id, 'volunteer:request', {
      offerId,
      message: 'Someone is waiting to talk.',
    });

    // Notify waiting user: "Someone is available to talk." with "Connect"
    this.sendToUser(waitingUserId, 'matching:state', {
      state: 'volunteer_available',
      offerId,
      message: 'Someone is available to talk.',
    });
  }

  // Handle volunteer action
  respondToVolunteerOffer(offerId: string, volunteerId: string, action: 'connect' | 'not_now') {
    const offer = this.volunteerOffers.get(offerId);
    if (!offer || offer.volunteerId !== volunteerId) return;

    this.volunteerOffers.delete(offerId);

    const restriction = db.isUserSuspendedOrBanned(volunteerId);
    if (restriction.isRestricted) {
      this.sendToUser(offer.waitingUserId, 'matching:state', {
        state: 'searching',
        message: "Finding someone who's available...",
      });
      return;
    }

    if (action === 'connect') {
      // Create session between waiting user and volunteer
      this.waitingPool.delete(offer.waitingUserId);
      this.createPendingSession(offer.waitingUserId, volunteerId, true);
    } else {
      // Volunteer declined
      this.sendToUser(offer.waitingUserId, 'matching:state', {
        state: 'searching',
        message: "Finding someone who's available...",
      });
    }
  }

  // Create a pending match where both see "Someone is here." with "Connect", or instant pair for queue users
  createPendingSession(user1Id: string, user2Id: string, isVolunteerMatch: boolean, matchedTopics: string[] = []) {
    const user1 = db.getUserById(user1Id);
    const user2 = db.getUserById(user2Id);
    if (!user1 || !user2) return;

    const roomId = 'room_' + crypto.randomBytes(8).toString('hex');
    const session: MatchSession = {
      roomId,
      user1Id,
      user2Id,
      user1Name: user1.displayName,
      user2Name: user2.displayName,
      status: 'waiting_connect',
      user1Connected: false,
      user2Connected: false,
      isVolunteerMatch,
      createdAt: Date.now(),
      messageCount: 0,
      postChoices: {},
    };

    this.activeSessions.set(roomId, session);
    this.userToRoom.set(user1Id, roomId);
    this.userToRoom.set(user2Id, roomId);

    console.log(`[Matchmaker] Paired user ${user1Id} and user ${user2Id} into room: ${roomId}`);

    // If both users are already waiting in the pool (non-volunteer), instant pair directly into active chat!
    if (!isVolunteerMatch) {
      session.status = 'active';
      session.user1Connected = true;
      session.user2Connected = true;

      db.updateUser(user1Id, { status: 'connected' });
      db.updateUser(user2Id, { status: 'connected' });

      // Track recent partner
      const recent1 = [user2Id, ...(user1.recentPartnerIds || [])].slice(0, 5);
      db.updateUser(user1Id, { recentPartnerIds: recent1 });
      const recent2 = [user1Id, ...(user2.recentPartnerIds || [])].slice(0, 5);
      db.updateUser(user2Id, { recentPartnerIds: recent2 });

      this.sendToUser(user1Id, 'session:start', {
        roomId,
        partnerId: user2Id,
        partnerDisplayName: user2.displayName,
        matchedTopics,
      });

      this.sendToUser(user2Id, 'session:start', {
        roomId,
        partnerId: user1Id,
        partnerDisplayName: user1.displayName,
        matchedTopics,
      });

      console.log(`[Matchmaker] Instant pairing: user ${user1Id} and user ${user2Id} transitioned directly into active chat (room: ${roomId})`);
      return;
    }

    // Otherwise, for volunteer fallback matches, show "Someone is here." with "Connect" button
    db.updateUser(user1Id, { status: 'matching' });
    db.updateUser(user2Id, { status: 'matching' });

    this.sendToUser(user1Id, 'match:found', {
      roomId,
      message: 'Someone is here.',
    });
    this.sendToUser(user2Id, 'match:found', {
      roomId,
      message: 'Someone is here.',
    });
    console.log(`[Matchmaker] Match notification emitted to both sockets: user ${user1Id} and user ${user2Id} (room: ${roomId})`);

    // Give users at least 25 seconds to accept before timing out
    setTimeout(() => {
      const sess = this.activeSessions.get(roomId);
      if (sess && sess.status === 'waiting_connect') {
        this.sendToUser(user1Id, 'match:failed', { message: 'Connection timed out.' });
        this.sendToUser(user2Id, 'match:failed', { message: 'Connection timed out.' });
        this.endSession(roomId, 'Connection timed out.');
      }
    }, 25000);
  }

  // User presses "Connect" on the "Someone is here" screen
  acceptMatch(userId: string, roomId: string) {
    const restriction = db.isUserSuspendedOrBanned(userId);
    if (restriction.isRestricted) {
      this.sendToUser(userId, 'matching:state', { state: 'idle' });
      return;
    }

    const session = this.activeSessions.get(roomId);
    if (!session || session.status !== 'waiting_connect') {
      this.sendToUser(userId, 'match:failed', {
        message: 'This conversation offer is no longer available.',
      });
      return;
    }

    if (session.user1Id === userId) {
      session.user1Connected = true;
    } else if (session.user2Id === userId) {
      session.user2Connected = true;
    }

    // If both clicked connect, begin active conversation!
    if (session.user1Connected && session.user2Connected) {
      session.status = 'active';

      db.updateUser(session.user1Id, { status: 'connected' });
      db.updateUser(session.user2Id, { status: 'connected' });

      // Track recent partner
      const u1 = db.getUserById(session.user1Id);
      const u2 = db.getUserById(session.user2Id);
      if (u1) {
        const recent = [session.user2Id, ...(u1.recentPartnerIds || [])].slice(0, 5);
        db.updateUser(session.user1Id, { recentPartnerIds: recent });
      }
      if (u2) {
        const recent = [session.user1Id, ...(u2.recentPartnerIds || [])].slice(0, 5);
        db.updateUser(session.user2Id, { recentPartnerIds: recent });
      }

      // Notify both that the conversation has started
      this.sendToUser(session.user1Id, 'session:start', {
        roomId,
        partnerId: session.user2Id,
        partnerDisplayName: session.user2Name,
      });

      this.sendToUser(session.user2Id, 'session:start', {
        roomId,
        partnerId: session.user1Id,
        partnerDisplayName: session.user1Name,
      });
      console.log(`[Matchmaker] Active session started, match notification emitted to both sockets: user ${session.user1Id} and user ${session.user2Id} (room: ${roomId})`);
    } else {
      // User is waiting for the other party to also hit Connect
      this.sendToUser(userId, 'match:waiting_partner', {
        roomId,
        message: 'Connecting to room... waiting for partner',
      });
    }
  }

  // Send message in an active session
  sendMessage(senderId: string, roomId: string, text: string): { success: boolean; error?: string } {
    const session = this.activeSessions.get(roomId);
    if (!session || session.status !== 'active') {
      return { success: false, error: 'No active session found.' };
    }

    const restriction = db.isUserSuspendedOrBanned(senderId);
    if (restriction.isRestricted) {
      return { success: false, error: restriction.reason || 'User is restricted or suspended' };
    }

    const sender = db.getUserById(senderId);
    if (!sender) return { success: false, error: 'User not found' };

    // Off-platform links and handles scrambler to protect user anonymity
    const { sanitized, wasModified } = sanitizeOffPlatformContent(text);

    session.messageCount = (session.messageCount || 0) + 1;

    const recipientId = session.user1Id === senderId ? session.user2Id : session.user1Id;

    const msg: ChatMessage = {
      id: 'msg_' + crypto.randomBytes(6).toString('hex'),
      roomId,
      senderId,
      senderName: sender.displayName,
      text: sanitized,
      timestamp: Date.now(),
    };

    // Broadcast message to both sender and recipient
    this.sendToUser(senderId, 'chat:message', msg);
    this.sendToUser(recipientId, 'chat:message', msg);

    // If external link or handle was hidden, notify sender with friendly notice
    if (wasModified) {
      this.sendToUser(senderId, 'chat:notice', {
        message: 'Sharing external links or handles is disabled to protect anonymity.',
      });
    }

    // If talking with the simulated companion, trigger automated 2-second reply
    if (recipientId === BOT_USER_ID) {
      simulator.handleUserMessage(senderId, roomId, sanitized, this);
    }

    return { success: true };
  }

  // Handle immediate enforcement for serious violations
  handleSafetyViolation(
    offendingUserId: string,
    roomId: string,
    safety: SafetyEvaluation,
    offendingText: string
  ) {
    simulator.clearTimer(roomId);
    const session = this.activeSessions.get(roomId);
    const offendingUser = db.getUserById(offendingUserId);
    if (!offendingUser) return;

    // 1. Remove offending user from matching pool and active session
    this.leaveMatching(offendingUserId);

    let innocentPartnerId: string | null = null;
    let innocentPartnerName: string | null = null;
    if (session) {
      innocentPartnerId = session.user1Id === offendingUserId ? session.user2Id : session.user1Id;
      innocentPartnerName = session.user1Id === offendingUserId ? session.user2Name : session.user1Name;

      session.status = 'ended';
      this.activeSessions.delete(roomId);
      this.userToRoom.delete(session.user1Id);
      this.userToRoom.delete(session.user2Id);
    }

    // 2. Apply progressive server-side suspension (30 days -> 90 days -> permanent ban)
    const { user: updatedUser, record, penalty } = db.applyProgressiveSuspension(
      offendingUserId,
      safety.reason || 'Violation of rules regarding sexual behaviour or solicitation.',
      offendingText,
      safety.isSeverePredatory
    );

    // 3. Log moderation flag for human review in Admin Dashboard
    db.addFlag({
      userId: offendingUserId,
      displayName: offendingUser.displayName,
      roomId,
      triggerCategory: safety.category || 'sexual_solicitation',
      flaggedText: offendingText,
      severity: safety.severity === 'severe' ? 'high' : 'high',
    });

    // 4. Notify offending user of immediate conversation termination and account suspension
    let penaltyNotice = '';
    if (penalty === 'permanent_ban') {
      penaltyNotice = 'Your conversation was ended immediately and your account has been permanently removed for severe or repeated sexual behaviour violations.';
    } else if (penalty === '90_day_suspension') {
      penaltyNotice = 'Your conversation was ended immediately and your account has been suspended for 90 days for repeated sexual behaviour violations.';
    } else {
      penaltyNotice = 'Your conversation was ended immediately and your account has been suspended for 30 days for violating Someone’s rules regarding sexual behaviour.';
    }

    this.sendToUser(offendingUserId, 'session:enforcement', {
      roomId,
      status: updatedUser.status,
      suspendedUntil: updatedUser.suspendedUntil,
      reason: updatedUser.restrictionReason,
      message: penaltyNotice,
      penalty,
    });

    this.sendToUser(offendingUserId, 'matching:state', { state: 'idle' });

    // Immediately terminate active WebSocket connections for the offending user
    this.closeUserSockets(offendingUserId, updatedUser.restrictionReason || penaltyNotice);

    // 5. Notify innocent partner WITHOUT revealing offending user's identity or private information
    if (innocentPartnerId) {
      db.updateUser(innocentPartnerId, { status: 'offline' });
      this.sendToUser(innocentPartnerId, 'session:ended', {
        roomId,
        reason: 'The conversation was ended due to a community safety guideline violation.',
        promptFriendship: false,
        safetyIntervention: true,
      });
      this.sendToUser(innocentPartnerId, 'matching:state', { state: 'idle' });
    }
  }

  // Verify whether a user is an active participant in a room
  isUserInRoom(userId: string, roomId: string): boolean {
    const session = this.activeSessions.get(roomId);
    if (!session) return false;
    return session.user1Id === userId || session.user2Id === userId;
  }

  // End an active session (by user disconnect or timeout)
  endSession(roomId: string, reason: string = 'Conversation ended') {
    simulator.clearTimer(roomId);
    const session = this.activeSessions.get(roomId);
    if (!session) return;

    const hadActiveChat = session.status === 'active' && (session.messageCount || 0) > 0;
    session.status = 'ended';
    this.activeSessions.delete(roomId);
    this.userToRoom.delete(session.user1Id);
    this.userToRoom.delete(session.user2Id);

    db.updateUser(session.user1Id, { status: 'offline' });
    db.updateUser(session.user2Id, { status: 'offline' });

    if (hadActiveChat) {
      // Record verified completed conversation session in persistent database with server signature
      const completedSession = db.recordCompletedSession(roomId, session.user1Id, session.user2Id, session.createdAt);

      // Notify both users of disconnect, and prompt for mutual friendship with server signature
      this.sendToUser(session.user1Id, 'partner_disconnected', { roomId, reason });
      this.sendToUser(session.user2Id, 'partner_disconnected', { roomId, reason });

      this.sendToUser(session.user1Id, 'session:ended', {
        roomId,
        partnerId: session.user2Id,
        partnerDisplayName: session.user2Name,
        reason,
        promptFriendship: true,
        messageCount: session.messageCount,
        sessionSignature: completedSession.serverSignature,
      });

      this.sendToUser(session.user2Id, 'session:ended', {
        roomId,
        partnerId: session.user1Id,
        partnerDisplayName: session.user1Name,
        reason,
        promptFriendship: true,
        messageCount: session.messageCount,
        sessionSignature: completedSession.serverSignature,
      });
    } else {
      // Chat was aborted before entering room, timed out, or had 0 messages sent
      this.sendToUser(session.user1Id, 'partner_disconnected', { roomId, reason });
      this.sendToUser(session.user2Id, 'partner_disconnected', { roomId, reason });

      this.sendToUser(session.user1Id, 'session:ended', {
        roomId,
        reason,
        promptFriendship: false,
        messageCount: 0,
      });
      this.sendToUser(session.user2Id, 'session:ended', {
        roomId,
        reason,
        promptFriendship: false,
        messageCount: 0,
      });
      this.sendToUser(session.user1Id, 'matching:state', { state: 'idle', message: reason });
      this.sendToUser(session.user2Id, 'matching:state', { state: 'idle', message: reason });
    }
  }

  // Real-time ephemeral typing indicator
  handleTyping(userId: string, roomId: string, isTyping: boolean) {
    const session = this.activeSessions.get(roomId);
    if (!session || session.status !== 'active') return;
    if (session.user1Id !== userId && session.user2Id !== userId) return;

    const recipientId = session.user1Id === userId ? session.user2Id : session.user1Id;
    this.sendToUser(recipientId, 'user_typing', { isTyping, senderId: userId, roomId });
    this.sendToUser(recipientId, 'chat:typing', { isTyping, senderId: userId, roomId });
  }

  // Teardown current conversation and immediately enter matching for the next partner
  skipToNext(userId: string, topics: string[] = []): { success: boolean; message?: string } {
    const roomId = this.userToRoom.get(userId);
    if (roomId) {
      this.endSession(roomId, 'Partner skipped to next conversation');
    }
    return this.enterMatching(userId, topics);
  }

  // User submits choice on "Would you like to talk to this person again?"
  submitFriendshipChoice(
    userId: string,
    partnerId: string,
    wantsToTalkAgain: boolean,
    roomId?: string,
    sessionSignature?: string
  ) {
    const user = db.getUserById(userId);
    const partner = db.getUserById(partnerId);
    if (!user || !partner) return;

    if (!roomId) {
      this.sendToUser(userId, 'friendship:error', {
        message: 'A valid completed conversation session ID is required.',
      });
      return;
    }

    // Verify session in database (server-side proof of genuine completed conversation with cryptographic signature)
    const result = db.recordPostChatChoice(roomId, userId, partnerId, wantsToTalkAgain, sessionSignature);
    if (!result.success) {
      this.sendToUser(userId, 'friendship:error', {
        message: result.error || 'Unable to record friendship preference.',
      });
      return;
    }

    if (result.mutual) {
      // Mutual agreement! Both independently consented for this specific completed session
      this.sendToUser(userId, 'friendship:created', {
        partnerId,
        partnerDisplayName: partner.displayName,
        message: 'Mutual connection formed! You can now message in your Friends list.',
      });

      this.sendToUser(partnerId, 'friendship:created', {
        partnerId: userId,
        partnerDisplayName: user.displayName,
        message: 'Mutual connection formed! You can now message in your Friends list.',
      });
    } else {
      // Sent confirmation of their choice, no disclosure of partner's choice
      this.sendToUser(userId, 'friendship:choice_recorded', {
        choice: wantsToTalkAgain,
      });
    }
  }

  handleUserDisconnect(userId: string) {
    const roomId = this.userToRoom.get(userId);
    if (roomId) {
      const session = this.activeSessions.get(roomId);
      if (session && session.status === 'waiting_connect') {
        const otherUserId = session.user1Id === userId ? session.user2Id : session.user1Id;
        this.sendToUser(otherUserId, 'match:failed', {
          message: 'Partner disconnected.',
        });
      }
      this.endSession(roomId, 'Partner disconnected.');
    }
  }

  getActiveSessionsCount(): number {
    let count = 0;
    for (const sess of this.activeSessions.values()) {
      if (sess.status === 'active') count++;
    }
    return count;
  }

  getWaitingCount(): number {
    return this.waitingPool.size;
  }

  getActiveSocketsCount(): number {
    return this.clients.size;
  }

  // ----------------------------------------------------
  // Test Companion / Simulator Integrations
  // ----------------------------------------------------
  registerActiveSession(roomId: string, session: MatchSession) {
    this.activeSessions.set(roomId, session);
    this.userToRoom.set(session.user1Id, roomId);
    this.userToRoom.set(session.user2Id, roomId);
  }

  createCompanionSession(userId: string): { success: boolean; roomId?: string; error?: string } {
    const user = db.getUserById(userId);
    const isAdmin = Boolean(user?.role === 'admin' || (user as any)?.isAdmin);
    if (process.env.NODE_ENV === 'production' && !isAdmin) {
      return { success: false, error: 'Simulator disabled in production' };
    }
    return simulator.startCompanionSession(userId, this);
  }

  simulateCompanionAction(userId: string, roomId: string, action: 'violation' | 'clean_chat') {
    const user = db.getUserById(userId);
    const isAdmin = Boolean(user?.role === 'admin' || (user as any)?.isAdmin);
    if (process.env.NODE_ENV === 'production' && !isAdmin) {
      return { success: false, error: 'Simulator disabled in production' };
    }
    if (action === 'violation') {
      return simulator.simulateViolation(userId, roomId, this);
    } else {
      return simulator.simulateCleanChat(userId, roomId, this);
    }
  }

  isCompanionRoom(roomId: string): boolean {
    const session = this.activeSessions.get(roomId);
    return Boolean(session && (session.user1Id === BOT_USER_ID || session.user2Id === BOT_USER_ID));
  }

  /**
   * Graceful shutdown: cleanly disconnects all connected sockets with status 1001 (Going Away),
   * clears matching queues, and resets active in-memory session indices.
   */
  closeAll(code: number = 1001, reason: string = 'Server shutting down (Going Away)') {
    for (const [, client] of this.clients.entries()) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(code, reason);
        }
      } catch {
        // Safe ignore during teardown
      }
    }
    this.clients.clear();
    this.waitingPool.clear();
    this.activeSessions.clear();
    this.userToRoom.clear();
    this.volunteerOffers.clear();
  }
}

export const matchmaker = new Matchmaker();
