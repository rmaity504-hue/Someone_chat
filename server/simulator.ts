import crypto from 'crypto';
import { db } from './db.js';
import { MatchSession, PrivateUserRecord } from '../src/types.js';
import { evaluateMessageSafety } from './safety.js';
import type { Matchmaker } from './matchmaker.js';

export const BOT_USER_ID = 'usr_simulated_companion';
export const BOT_NAME = 'Simulated Stranger';

class MatchmakerSimulator {
  private replyTimers: Map<string, NodeJS.Timeout> = new Map(); // roomId -> timeout
  private conversationStep: Map<string, number> = new Map(); // roomId -> step count

  /**
   * Ensures the Simulated Stranger account exists in memory and PostgreSQL.
   * If the bot account was previously suspended during testing, resets its status to 'available'.
   */
  ensureBotUser() {
    const botRecord: PrivateUserRecord = {
      id: BOT_USER_ID,
      displayName: BOT_NAME,
      email: 'stranger.simulator@someone.local',
      passwordHash: 'dummy_hash_simulator',
      isVerified: true,
      isAgeConfirmed: true,
      role: 'user',
      status: 'available',
      safetyAcknowledged: true,
      isVolunteer: false,
      volunteerActive: false,
      createdAt: Date.now(),
      blockedUserIds: [],
      recentPartnerIds: [],
    };
    db.ensureBotUser(botRecord);
  }

  /**
   * Pair the user directly with the Simulated Companion in an active room.
   */
  startCompanionSession(userId: string, matchmaker: Matchmaker): { success: boolean; roomId?: string; error?: string } {
    const user = db.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    const isAdmin = Boolean(user.role === 'admin' || (user as any).isAdmin);
    if (process.env.NODE_ENV === 'production' && !isAdmin) {
      return { success: false, error: 'Simulator disabled in production' };
    }

    this.ensureBotUser();

    // Leave any pending queue or disconnect any ongoing conversation
    matchmaker.leaveMatching(userId);
    matchmaker.handleUserDisconnect(userId);

    const roomId = 'room_sim_' + crypto.randomBytes(6).toString('hex');
    const session: MatchSession = {
      roomId,
      user1Id: userId,
      user2Id: BOT_USER_ID,
      user1Name: user.displayName,
      user2Name: BOT_NAME,
      status: 'active',
      user1Connected: true,
      user2Connected: true,
      isVolunteerMatch: false,
      createdAt: Date.now(),
      postChoices: {},
    };

    matchmaker.registerActiveSession(roomId, session);

    db.updateUser(userId, { status: 'connected' });
    db.updateUser(BOT_USER_ID, { status: 'connected' });

    // Track recent partner for user
    const recent = [BOT_USER_ID, ...(user.recentPartnerIds || [])].slice(0, 5);
    db.updateUser(userId, { recentPartnerIds: recent });

    this.conversationStep.set(roomId, 0);

    // Send session:start immediately to transition the user directly into ChatView
    matchmaker.sendToUser(userId, 'session:start', {
      roomId,
      partnerId: BOT_USER_ID,
      partnerDisplayName: BOT_NAME,
      isSimulator: true,
    });

    console.log(`[SIMULATOR] Started test companion session for user ${userId} in room ${roomId}`);
    return { success: true, roomId };
  }

  /**
   * Handles user incoming message in a companion room.
   * Auto-responds after 2 seconds to any message sent by the user.
   */
  handleUserMessage(userId: string, roomId: string, userText: string, matchmaker: Matchmaker) {
    if (userId === BOT_USER_ID) return;

    // Clear any pending reply timer for this room
    if (this.replyTimers.has(roomId)) {
      clearTimeout(this.replyTimers.get(roomId)!);
      this.replyTimers.delete(roomId);
    }

    const step = (this.conversationStep.get(roomId) || 0) + 1;
    this.conversationStep.set(roomId, step);

    const timer = setTimeout(() => {
      this.replyTimers.delete(roomId);

      // Verify the room is still active
      if (!matchmaker.isUserInRoom(userId, roomId) || !matchmaker.isUserInRoom(BOT_USER_ID, roomId)) {
        return;
      }

      const botReply = this.generateBotResponse(step, userText);
      matchmaker.sendMessage(BOT_USER_ID, roomId, botReply);
    }, 2000);

    this.replyTimers.set(roomId, timer);
  }

  /**
   * Generates realistic, gentle companion responses.
   * The first response explicitly confirms: "Hello! I am a simulated partner for testing."
   */
  private generateBotResponse(step: number, userText: string): string {
    if (step === 1) {
      return 'Hello! I am a simulated partner for testing.';
    }

    const responses = [
      'I hear you. It is nice having a quiet space to chat without any distractions or pressure.',
      'Thank you for sharing that with me. How has the rest of your day been treating you?',
      'That makes sense. It is comforting to know there is another person on the other end just listening.',
      'I am enjoying our conversation. Feel free to keep chatting, or use the test helpers above to test clean completion or moderation.',
      'Small moments of human connection can make a big difference in someone’s day.',
      'I appreciate your thoughts. Take all the time you need.',
    ];

    const idx = (step - 2) % responses.length;
    return responses[idx];
  }

  /**
   * Action 1: "Simulate Harassment / Violation"
   * The bot sends a test policy violation to verify that the moderation filter immediately
   * catches it, blocks the message, and terminates the session.
   */
  simulateViolation(userId: string, roomId: string, matchmaker: Matchmaker): { success: boolean; error?: string } {
    const user = db.getUserById(userId);
    const isAdmin = Boolean(user?.role === 'admin' || (user as any)?.isAdmin);
    if (process.env.NODE_ENV === 'production' && !isAdmin) {
      return { success: false, error: 'Simulator disabled in production' };
    }

    if (!matchmaker.isUserInRoom(userId, roomId) || !matchmaker.isUserInRoom(BOT_USER_ID, roomId)) {
      return { success: false, error: 'No active companion session found for this room.' };
    }

    // Cancel any pending automatic response
    this.clearTimer(roomId);

    // Explicit test policy violation that triggers evaluateMessageSafety
    const violatingText = 'send me nudes right now';
    const safety = evaluateMessageSafety(violatingText);

    console.log(`[SIMULATOR] Executing safety violation simulation for room ${roomId}:`, safety);

    // Call matchmaker.handleSafetyViolation with BOT_USER_ID as the offending user.
    // This immediately:
    // 1. Blocks the message from ever reaching the user's chat screen
    // 2. Terminates the session
    // 3. Applies disciplinary flag & penalty to BOT_USER_ID in db
    // 4. Sends session:ended with safetyIntervention: true to the innocent user
    matchmaker.handleSafetyViolation(BOT_USER_ID, roomId, safety, violatingText);

    return { success: true };
  }

  /**
   * Action 2: "Simulate Clean Chat"
   * The bot exchanges normal conversational dialogue to test the mutual post-chat
   * friendship modal and normal disconnection flows.
   */
  simulateCleanChat(userId: string, roomId: string, matchmaker: Matchmaker): { success: boolean; error?: string } {
    const user = db.getUserById(userId);
    const isAdmin = Boolean(user?.role === 'admin' || (user as any)?.isAdmin);
    if (process.env.NODE_ENV === 'production' && !isAdmin) {
      return { success: false, error: 'Simulator disabled in production' };
    }

    if (!matchmaker.isUserInRoom(userId, roomId) || !matchmaker.isUserInRoom(BOT_USER_ID, roomId)) {
      return { success: false, error: 'No active companion session found for this room.' };
    }

    this.clearTimer(roomId);

    // 1. Bot sends normal, warm closing dialogue
    const closingMessage =
      'I really appreciated talking with you today. Thank you for sharing your time with me!';
    matchmaker.sendMessage(BOT_USER_ID, roomId, closingMessage);

    // 2. Shortly after the message is displayed, end the session cleanly
    setTimeout(() => {
      // Check if room is still valid
      if (!matchmaker.isUserInRoom(userId, roomId)) return;

      // End session cleanly
      matchmaker.endSession(roomId, 'Simulated Stranger ended the conversation.');

      // Pre-consent to friendship on behalf of the bot so when the user clicks "Yes",
      // the mutual consent test succeeds immediately!
      db.preApproveCompletedSession(roomId, BOT_USER_ID);
    }, 1000);

    return { success: true };
  }

  clearTimer(roomId: string) {
    if (this.replyTimers.has(roomId)) {
      clearTimeout(this.replyTimers.get(roomId)!);
      this.replyTimers.delete(roomId);
    }
    this.conversationStep.delete(roomId);
  }
}

export const simulator = new MatchmakerSimulator();
