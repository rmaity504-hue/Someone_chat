export type UserRole = 'user' | 'volunteer' | 'moderator' | 'admin';

export type UserStatus =
  | 'offline'
  | 'available'
  | 'matching'
  | 'connected'
  | 'volunteer_available'
  | 'restricted'
  | 'suspended'
  | 'banned';

export interface UserProfile {
  id: string;
  displayName: string;
  isVerified: boolean;
  role: UserRole;
  isAdmin?: boolean;
  status: UserStatus;
  safetyAcknowledged: boolean;
  isVolunteer: boolean;
  volunteerActive: boolean;
  createdAt: number;
  restrictionReason?: string;
  suspendedUntil?: number;
  violationCount?: number;
}

export interface ModerationRecord {
  id: string;
  userId: string;
  timestamp: number;
  reason: string;
  evidenceSnippet: string;
  penalty: 'warning' | '30_day_suspension' | '90_day_suspension' | 'permanent_ban';
  suspendedUntil?: number;
  reviewedBy?: string;
}

export interface PrivateUserRecord extends UserProfile {
  email: string;
  passwordHash: string;
  isAgeConfirmed: boolean;
  verificationCode?: string;
  verificationExpiresAt?: number;
  verificationAttempts?: number;
  verificationToken?: string;
  verificationTokenExpiresAt?: number;
  blockedUserIds: string[];
  recentPartnerIds: string[];
  postChoices?: Record<string, boolean>;
  notes?: string;
  ipAddress?: string;
  registeredIp?: string;
  violationCount?: number;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  revokedAt?: number;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
}

export interface CompletedSessionRecord {
  sessionId: string;
  user1Id: string;
  user2Id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  choices: Record<string, boolean>;
  friendshipCreated: boolean;
  expiresAt: number;
  serverSignature?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  system?: boolean;
}

export interface MatchSession {
  roomId: string;
  user1Id: string;
  user2Id: string;
  user1Name: string;
  user2Name: string;
  status: 'waiting_connect' | 'active' | 'ended';
  user1Connected: boolean;
  user2Connected: boolean;
  isVolunteerMatch: boolean;
  createdAt: number;
  postChoices?: Record<string, boolean>; // userId -> want to talk again
}

export interface Friendship {
  id: string;
  partnerId: string;
  partnerDisplayName: string;
  createdAt: number;
  lastMessageAt?: number;
}

export type ReportCategory =
  | 'sexual_solicitation'
  | 'unwanted_sexual_content'
  | 'harassment'
  | 'threats'
  | 'coercion'
  | 'predatory_behaviour'
  | 'manipulation'
  | 'scams'
  | 'spam'
  | 'ban_evasion'
  | 'other';

export interface ReportRecord {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reportedDisplayName: string;
  roomId?: string;
  category: ReportCategory;
  details: string;
  evidenceSnippet?: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  createdAt: number;
  reviewedBy?: string;
  actionTaken?: string;
}

export interface ModerationFlagRecord {
  id: string;
  userId: string;
  displayName: string;
  roomId?: string;
  triggerCategory: string;
  flaggedText: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  reviewed: boolean;
}

export interface AppealRecord {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedAt?: number;
  adminNote?: string;
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  activeSockets: number;
  currentlyMatching: number;
  activeConversations: number;
  availableVolunteers: number;
  pendingReports: number;
  totalConversationsCompleted: number;
  totalMutualFriendships: number;
}
