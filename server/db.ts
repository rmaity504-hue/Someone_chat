import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import {
  UserProfile,
  PrivateUserRecord,
  Friendship,
  ReportRecord,
  ModerationFlagRecord,
  ModerationRecord,
  AppealRecord,
  SessionRecord,
  CompletedSessionRecord,
  PasswordResetRecord,
} from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ----------------------------------------------------
// Password KDF using Node.js scrypt (N=16384, r=8, p=1)
// ----------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length < 4) return false;
    const salt = parts[2];
    const key = parts[3];
    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
  }
  // Migration fallback for legacy hash if present in dev
  try {
    const oldHash = crypto.createHash('sha256').update(password + '_someone_salt_2026').digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(oldHash))) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

import {
  SESSION_SIGNING_SECRET,
  signCompletedSession,
  verifyCompletedSessionSignature,
} from './auth.js';

export {
  SESSION_SIGNING_SECRET,
  signCompletedSession,
  verifyCompletedSessionSignature,
};

interface DatabaseSchema {
  users: Record<string, PrivateUserRecord>;
  sessions: Record<string, SessionRecord>; // tokenHash -> SessionRecord
  passwordResets: Record<string, PasswordResetRecord>; // id -> PasswordResetRecord
  friendships: Record<string, { id: string; user1Id: string; user2Id: string; createdAt: number }>;
  completedSessions: Record<string, CompletedSessionRecord>;
  reports: Record<string, ReportRecord>;
  flags: Record<string, ModerationFlagRecord>;
  moderationRecords: Record<string, ModerationRecord>;
  appeals: Record<string, AppealRecord>;
  bannedIps: Record<string, { ip: string; reason: string; createdAt: number }>;
  conversationsCompletedCount: number;
}

class Storage {
  private data: DatabaseSchema = {
    users: {},
    sessions: {},
    passwordResets: {},
    friendships: {},
    completedSessions: {},
    reports: {},
    flags: {},
    moderationRecords: {},
    appeals: {},
    bannedIps: {},
    conversationsCompletedCount: 0,
  };

  private pgPool: pg.Pool | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;

  constructor() {
    this.init();
  }

  private async init() {
    // 1. Initialize directory if using local fallback
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Error creating data directory:', err);
      }
    }

    // 2. Load from disk fallback first
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || {},
          sessions: parsed.sessions || {},
          passwordResets: parsed.passwordResets || {},
          friendships: parsed.friendships || {},
          completedSessions: parsed.completedSessions || {},
          reports: parsed.reports || {},
          flags: parsed.flags || {},
          moderationRecords: parsed.moderationRecords || {},
          appeals: parsed.appeals || {},
          bannedIps: parsed.bannedIps || {},
          conversationsCompletedCount: parsed.conversationsCompletedCount || 0,
        };

        // Ensure all users are permanently verified
        for (const u of Object.values(this.data.users)) {
          u.isVerified = true;
        }
      } catch (err) {
        console.error('Failed to parse local db.json:', err);
      }
    }

    // 3. If PostgreSQL DATABASE_URL is provided, connect and initialize
    if (process.env.DATABASE_URL) {
      try {
        this.pgPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 30000,
        });
        await this.initPostgresSchema();
        await this.loadFromPostgres();
        console.log('[DATABASE] Connected to PostgreSQL database successfully.');
      } catch (pgErr) {
        console.error('[DATABASE ERROR] Failed to connect to PostgreSQL. Using persistent adapter fallback:', pgErr);
      }
    } else {
      console.log('[DATABASE] Running with persistent database storage abstraction (PostgreSQL DATABASE_URL ready).');
    }

    // 4. Secure Admin Provisioning (from environment variables, never hardcoded in source)
    this.provisionConfiguredAdmin();
  }

  private async initPostgresSchema() {
    if (!this.pgPool) return;

    // 1. Ensure any pre-existing users table has all required columns before schema indexes run
    await this.pgPool
      .query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(16);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at BIGINT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts INT DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at BIGINT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_age_confirmed BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'user';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'offline';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS safety_acknowledged BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_volunteer BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS volunteer_active BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until BIGINT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS restriction_reason TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS registered_ip VARCHAR(64);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_ips TEXT[] DEFAULT ARRAY[]::TEXT[];
        ALTER TABLE users ADD COLUMN IF NOT EXISTS recent_partner_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
        ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_user_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
      `)
      .catch((e) => console.warn('[DATABASE] Pre-schema upgrade check (table may not exist yet):', e?.message || e));

    const schemaPath = path.join(process.cwd(), 'server', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await this.pgPool.query(sql);
    }

    // Also explicitly ensure password_resets table and verification columns are ready
    await this.pgPool
      .query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(128) NOT NULL,
          expires_at BIGINT NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
        CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
        CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at BIGINT;
        CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
      `)
      .catch((e) => console.warn('[DATABASE] schema upgrade check:', e?.message || e));
  }

  private async loadFromPostgres() {
    if (!this.pgPool) return;
    try {
      const usersRes = await this.pgPool.query('SELECT * FROM users');
      for (const row of usersRes.rows) {
        this.data.users[row.id] = {
          id: row.id,
          email: row.email,
          passwordHash: row.password_hash,
          displayName: row.display_name,
          isVerified: true,
          verificationCode: row.verification_code,
          verificationExpiresAt: row.verification_expires_at ? Number(row.verification_expires_at) : undefined,
          verificationAttempts: row.verification_attempts || 0,
          verificationToken: row.verification_token || undefined,
          verificationTokenExpiresAt: row.verification_token_expires_at ? Number(row.verification_token_expires_at) : undefined,
          isAgeConfirmed: row.is_age_confirmed,
          role: row.role,
          status: row.status,
          safetyAcknowledged: row.safety_acknowledged,
          isVolunteer: row.is_volunteer,
          volunteerActive: row.volunteer_active,
          createdAt: Number(row.created_at),
          suspendedUntil: row.suspended_until ? Number(row.suspended_until) : undefined,
          restrictionReason: row.restriction_reason || undefined,
          violationCount: row.violation_count || 0,
          registeredIp: row.registered_ip || undefined,
          recentPartnerIds: row.recent_partner_ids || [],
          blockedUserIds: row.blocked_user_ids || [],
        };
      }

      const sessRes = await this.pgPool.query('SELECT * FROM sessions WHERE revoked_at IS NULL AND expires_at > $1', [Date.now()]);
      for (const row of sessRes.rows) {
        this.data.sessions[row.token_hash] = {
          tokenHash: row.token_hash,
          userId: row.user_id,
          createdAt: Number(row.created_at),
          expiresAt: Number(row.expires_at),
          revokedAt: row.revoked_at ? Number(row.revoked_at) : undefined,
        };
      }

      try {
        const resetRes = await this.pgPool.query('SELECT * FROM password_resets WHERE used = FALSE AND expires_at > $1', [Date.now()]);
        for (const row of resetRes.rows) {
          this.data.passwordResets[row.id] = {
            id: row.id,
            userId: row.user_id,
            tokenHash: row.token_hash,
            expiresAt: Number(row.expires_at),
            used: Boolean(row.used),
            createdAt: Number(row.created_at),
          };
        }
      } catch (rErr) {
        // Table may not exist yet on initial run
      }
    } catch (err) {
      console.error('[DATABASE] Error loading state from PostgreSQL:', err);
    }
  }

  private provisionConfiguredAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Someone Administration';

    if (adminEmail && adminPassword) {
      let existingAdmin = this.getUserByEmail(adminEmail);
      if (!existingAdmin) {
        console.log(`[AUTH] Provisioning configured administrator account: ${adminEmail}`);
        const adminId = 'usr_admin_' + crypto.randomBytes(6).toString('hex');
        const adminRecord: PrivateUserRecord = {
          id: adminId,
          email: adminEmail,
          passwordHash: hashPassword(adminPassword),
          displayName: adminName,
          isVerified: true,
          isAgeConfirmed: true,
          role: 'admin',
          status: 'offline',
          safetyAcknowledged: true,
          isVolunteer: true,
          volunteerActive: false,
          createdAt: Date.now(),
          blockedUserIds: [],
          recentPartnerIds: [],
        };
        this.data.users[adminId] = adminRecord;
        this.scheduleSave();
      } else if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        this.scheduleSave();
      }
    }
  }

  /**
   * One-time secure admin bootstrap endpoint for server initialization
   */
  public bootstrapAdminAccount(
    email: string,
    password: string,
    displayName: string,
    bootstrapKey: string
  ): { success: boolean; error?: string; user?: UserProfile } {
    // Check if any admin already exists
    const hasAdmin = Object.values(this.data.users).some((u) => u.role === 'admin');
    if (hasAdmin) {
      return { success: false, error: 'An administrator account is already provisioned.' };
    }

    const envKey = process.env.ADMIN_BOOTSTRAP_KEY;
    if (!envKey) {
      return { success: false, error: 'Bootstrap disabled. ADMIN_BOOTSTRAP_KEY environment variable is not configured.' };
    }
    const bootstrapBuf = Buffer.from(bootstrapKey);
    const envKeyBuf = Buffer.from(envKey);
    if (bootstrapBuf.length !== envKeyBuf.length || !crypto.timingSafeEqual(bootstrapBuf, envKeyBuf)) {
      return { success: false, error: 'Invalid bootstrap key.' };
    }

    const cleanEmail = email.toLowerCase().trim();
    if (this.getUserByEmail(cleanEmail)) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const adminId = 'usr_admin_' + crypto.randomBytes(6).toString('hex');
    const admin: PrivateUserRecord = {
      id: adminId,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      displayName: displayName.trim() || 'Administrator',
      isVerified: true,
      isAgeConfirmed: true,
      role: 'admin',
      status: 'offline',
      safetyAcknowledged: true,
      isVolunteer: true,
      volunteerActive: false,
      createdAt: Date.now(),
      blockedUserIds: [],
      recentPartnerIds: [],
    };

    this.data.users[adminId] = admin;
    this.scheduleSave();
    return { success: true, user: this.toPublicProfile(admin) };
  }

  /**
   * Non-blocking asynchronous atomic persistence
   */
  private scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      await this.persistData();
    }, 100);
  }

  private async persistData() {
    if (this.isSaving) {
      this.scheduleSave();
      return;
    }
    this.isSaving = true;

    try {
      const serialized = JSON.stringify(this.data, null, 2);
      const tmpFile = `${DB_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fs.promises.writeFile(tmpFile, serialized, 'utf-8');
      await fs.promises.rename(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[DATABASE] Error saving persistent storage:', err);
    } finally {
      this.isSaving = false;
    }

    // If PostgreSQL pool exists, sync asynchronously
    if (this.pgPool) {
      this.syncPostgresBatch().catch((err) =>
        console.error('[DATABASE] Async PostgreSQL sync error:', err?.message || err)
      );
    }
  }

  private async syncPostgresBatch() {
    if (!this.pgPool) return;
    // Batch upsert users
    for (const user of Object.values(this.data.users)) {
      await this.pgPool.query(
        `INSERT INTO users (
          id, email, password_hash, display_name, is_verified, verification_code,
          verification_expires_at, verification_attempts, is_age_confirmed, role,
          status, safety_acknowledged, is_volunteer, volunteer_active, created_at,
          suspended_until, restriction_reason, violation_count, registered_ip,
          recent_partner_ids, blocked_user_ids
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name,
          is_verified = EXCLUDED.is_verified,
          verification_code = EXCLUDED.verification_code,
          verification_expires_at = EXCLUDED.verification_expires_at,
          verification_attempts = EXCLUDED.verification_attempts,
          status = EXCLUDED.status,
          suspended_until = EXCLUDED.suspended_until,
          restriction_reason = EXCLUDED.restriction_reason,
          violation_count = EXCLUDED.violation_count,
          blocked_user_ids = EXCLUDED.blocked_user_ids,
          volunteer_active = EXCLUDED.volunteer_active`,
        [
          user.id,
          user.email,
          user.passwordHash,
          user.displayName,
          user.isVerified,
          user.verificationCode || null,
          user.verificationExpiresAt || null,
          user.verificationAttempts || 0,
          user.isAgeConfirmed,
          user.role,
          user.status,
          user.safetyAcknowledged,
          user.isVolunteer,
          user.volunteerActive,
          user.createdAt,
          user.suspendedUntil || null,
          user.restrictionReason || null,
          user.violationCount || 0,
          user.registeredIp || null,
          user.recentPartnerIds || [],
          user.blockedUserIds || [],
        ]
      );
    }
  }

  // ----------------------------------------------------
  // User Management
  // ----------------------------------------------------
  getUserByEmail(email: string): PrivateUserRecord | undefined {
    const clean = email.toLowerCase().trim();
    return Object.values(this.data.users).find((u) => u.email.toLowerCase() === clean);
  }

  getUserById(id: string): PrivateUserRecord | undefined {
    const user = this.data.users[id];
    if (user && user.status === 'suspended' && user.suspendedUntil) {
      if (Date.now() >= user.suspendedUntil) {
        // Automatically lift expired suspension
        user.status = 'offline';
        delete user.suspendedUntil;
        delete user.restrictionReason;
        this.scheduleSave();
      }
    }
    return user;
  }

  createUser(
    email: string,
    passwordHash: string,
    displayName: string,
    ipAddress?: string,
    isVerified: boolean = true
  ): PrivateUserRecord {
    const id = 'usr_' + crypto.randomBytes(8).toString('hex');
    const user: PrivateUserRecord = {
      id,
      email: email.toLowerCase().trim(),
      passwordHash,
      displayName: displayName.trim(),
      isVerified,
      isAgeConfirmed: true,
      role: 'user',
      status: 'offline',
      safetyAcknowledged: false,
      isVolunteer: false,
      volunteerActive: false,
      createdAt: Date.now(),
      blockedUserIds: [],
      recentPartnerIds: [],
      registeredIp: ipAddress,
      ipAddress,
    };
    this.data.users[id] = user;
    if (this.pgPool) {
      this.pgPool
        .query(
          `INSERT INTO users (
            id, email, password_hash, display_name, is_verified, is_age_confirmed, role, status, safety_acknowledged, is_volunteer, volunteer_active, created_at, registered_ip
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET is_verified = EXCLUDED.is_verified`,
          [
            id,
            user.email,
            user.passwordHash,
            user.displayName,
            user.isVerified,
            user.isAgeConfirmed,
            user.role,
            user.status,
            user.safetyAcknowledged,
            user.isVolunteer,
            user.volunteerActive,
            user.createdAt,
            ipAddress || null,
          ]
        )
        .catch((err) => {
          console.error('[DATABASE] Error saving user to PostgreSQL:', err?.message || err);
        });
    }
    this.scheduleSave();
    return user;
  }

  deleteUnverifiedUser(userId: string): void {
    const user = this.data.users[userId];
    if (user && !user.isVerified) {
      delete this.data.users[userId];
      if (this.pgPool) {
        this.pgPool.query('DELETE FROM users WHERE id = $1 AND is_verified = FALSE', [userId]).catch(() => {});
      }
      this.scheduleSave();
    }
  }

  updateUser(id: string, updates: Partial<PrivateUserRecord>): PrivateUserRecord | undefined {
    const user = this.data.users[id];
    if (!user) return undefined;
    Object.assign(user, updates);
    this.scheduleSave();
    return user;
  }

  toPublicProfile(user: PrivateUserRecord): UserProfile {
    return {
      id: user.id,
      displayName: user.displayName,
      isVerified: user.isVerified,
      role: user.role,
      isAdmin: user.role === 'admin',
      status: user.status,
      safetyAcknowledged: user.safetyAcknowledged,
      isVolunteer: user.isVolunteer,
      volunteerActive: user.volunteerActive,
      createdAt: user.createdAt,
      restrictionReason: user.restrictionReason,
      suspendedUntil: user.suspendedUntil,
      violationCount: user.violationCount,
    };
  }

  // ----------------------------------------------------
  // Controlled Account Deletion (Privacy & Data Minimization)
  // ----------------------------------------------------
  async deleteUserAccount(userId: string): Promise<boolean> {
    const user = this.data.users[userId];
    if (!user) return false;

    // 1. Invalidate all active sessions
    this.revokeAllUserSessions(userId);

    // 2. Remove from friendships
    for (const [fId, f] of Object.entries(this.data.friendships)) {
      if (f.user1Id === userId || f.user2Id === userId) {
        delete this.data.friendships[fId];
      }
    }

    // 3. Remove from other users' block lists
    for (const otherUser of Object.values(this.data.users)) {
      if (otherUser.blockedUserIds.includes(userId)) {
        otherUser.blockedUserIds = otherUser.blockedUserIds.filter((id) => id !== userId);
      }
    }

    // Clear password reset records for this user
    for (const [rId, r] of Object.entries(this.data.passwordResets)) {
      if (r.userId === userId) {
        delete this.data.passwordResets[rId];
      }
    }

    // 4. Anonymize user records in moderation/reports and flags so logs preserve security audit
    // without retaining personal user identity
    for (const rep of Object.values(this.data.reports)) {
      if (rep.reportedUserId === userId) {
        rep.reportedDisplayName = '[Deleted Account]';
      }
      if (rep.reporterId === userId) {
        rep.reporterId = 'deleted_user';
      }
    }
    for (const fl of Object.values(this.data.flags)) {
      if (fl.userId === userId) {
        fl.displayName = '[Deleted Account]';
      }
    }

    // 5. Check if user is currently restricted/suspended/banned
    const hasRestriction =
      user.status === 'restricted' ||
      user.status === 'suspended' ||
      user.status === 'banned' ||
      (user.violationCount && user.violationCount > 0);

    if (hasRestriction) {
      // Retain the shell ID and restriction/audit status so banned/restricted actors cannot bypass
      // enforcement by deleting & re-registering, but completely purge all personally identifying credentials.
      user.email = `deleted_${userId}_${Date.now()}@anonymized.internal`;
      user.passwordHash = 'PURGED_DELETED_CREDENTIALS';
      user.displayName = '[Deleted User]';
      user.isVerified = false;
      user.verificationCode = undefined;
      user.verificationExpiresAt = undefined;
      user.registeredIp = undefined;
      user.recentPartnerIds = [];
      user.blockedUserIds = [];
      user.isVolunteer = false;
      user.volunteerActive = false;
      user.safetyAcknowledged = false;
    } else {
      // Complete removal of user record if no restriction exists
      delete this.data.users[userId];
    }

    // 6. PostgreSQL Cleanup if pgPool is active (using strictly parameterized SQL)
    if (this.pgPool) {
      try {
        // Remove sessions
        await this.pgPool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

        // Remove friendships
        await this.pgPool.query(
          'DELETE FROM friendships WHERE user1_id = $1 OR user2_id = $1',
          [userId]
        );

        // Remove blocks
        await this.pgPool.query(
          'DELETE FROM blocks WHERE user_id = $1 OR blocked_user_id = $1',
          [userId]
        );

        // Remove password resets
        await this.pgPool.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);

        // Anonymize reports and flags
        await this.pgPool.query(
          'UPDATE reports SET reported_display_name = $1 WHERE reported_user_id = $2',
          ['[Deleted Account]', userId]
        );
        await this.pgPool.query(
          'UPDATE moderation_flags SET display_name = $1 WHERE user_id = $2',
          ['[Deleted Account]', userId]
        );

        if (hasRestriction) {
          await this.pgPool.query(
            `UPDATE users SET
              email = $1,
              password_hash = $2,
              display_name = $3,
              is_verified = FALSE,
              verification_code = NULL,
              verification_expires_at = NULL,
              registered_ip = NULL,
              recent_partner_ids = ARRAY[]::TEXT[],
              blocked_user_ids = ARRAY[]::TEXT[],
              is_volunteer = FALSE,
              volunteer_active = FALSE
            WHERE id = $4`,
            [user.email, user.passwordHash, user.displayName, userId]
          );
        } else {
          await this.pgPool.query('DELETE FROM users WHERE id = $1', [userId]);
        }
      } catch (pgErr: any) {
        console.error('[DATABASE] PostgreSQL account deletion sync error:', pgErr?.message || pgErr);
      }
    }

    this.scheduleSave();
    return true;
  }

  // ----------------------------------------------------
  // Server-Side Session Management (Tokens with Expiration & Revocation)
  // ----------------------------------------------------
  createSession(userId: string): string {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7 days expiration
    const now = Date.now();

    const session: SessionRecord = {
      tokenHash,
      userId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    this.data.sessions[tokenHash] = session;
    this.scheduleSave();
    return rawToken;
  }

  getUserIdByToken(token: string): string | undefined {
    if (!token) return undefined;
    const tokenHash = hashToken(token);
    const session = this.data.sessions[tokenHash];
    if (!session) return undefined;

    // Check revocation
    if (session.revokedAt) return undefined;

    // Check expiration
    if (Date.now() > session.expiresAt) {
      delete this.data.sessions[tokenHash];
      this.scheduleSave();
      return undefined;
    }

    // Verify user exists and is not permanently banned
    const user = this.getUserById(session.userId);
    if (!user || user.status === 'banned') {
      return undefined;
    }

    return session.userId;
  }

  revokeSession(token: string): void {
    if (!token) return;
    const tokenHash = hashToken(token);
    if (this.data.sessions[tokenHash]) {
      this.data.sessions[tokenHash].revokedAt = Date.now();
      delete this.data.sessions[tokenHash];
      this.scheduleSave();
    }
  }

  revokeAllUserSessions(userId: string): void {
    for (const [hash, sess] of Object.entries(this.data.sessions)) {
      if (sess.userId === userId) {
        sess.revokedAt = Date.now();
        delete this.data.sessions[hash];
      }
    }
    if (this.pgPool) {
      this.pgPool.query('DELETE FROM sessions WHERE user_id = $1', [userId]).catch((err) => {
        console.error('[DATABASE] Error deleting sessions from PostgreSQL:', err?.message || err);
      });
    }
    this.scheduleSave();
  }

  // ----------------------------------------------------
  // Password Reset Management (15-min TTL, Replay Protection)
  // ----------------------------------------------------
  async createPasswordReset(userId: string, code: string, ttlMinutes = 15): Promise<PasswordResetRecord> {
    const id = 'rst_' + crypto.randomBytes(8).toString('hex');
    const tokenHash = hashToken(code.trim());
    const now = Date.now();
    const expiresAt = now + ttlMinutes * 60 * 1000;

    const record: PasswordResetRecord = {
      id,
      userId,
      tokenHash,
      expiresAt,
      used: false,
      createdAt: now,
    };

    this.data.passwordResets[id] = record;

    if (this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, userId, tokenHash, expiresAt, false, now]
        );
      } catch (pgErr: any) {
        console.error('[DATABASE] Error inserting password reset record into PostgreSQL:', pgErr?.message || pgErr);
      }
    }

    this.scheduleSave();
    return record;
  }

  async verifyAndConsumePasswordReset(
    userId: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    const tokenHash = hashToken(code.trim());
    const now = Date.now();

    // Check PostgreSQL first if active
    if (this.pgPool) {
      try {
        const res = await this.pgPool.query(
          `SELECT * FROM password_resets 
           WHERE user_id = $1 AND token_hash = $2 
           ORDER BY created_at DESC LIMIT 1`,
          [userId, tokenHash]
        );

        if (res.rows.length === 0) {
          return { success: false, error: 'Invalid or expired 6-digit reset code.' };
        }

        const row = res.rows[0];
        if (row.used) {
          return { success: false, error: 'This reset code has already been used. Please request a new code.' };
        }

        if (Number(row.expires_at) < now) {
          return { success: false, error: 'This reset code has expired. Please request a new code.' };
        }

        // Mark as used immediately to prevent replay attacks
        await this.pgPool.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [row.id]);
        if (this.data.passwordResets[row.id]) {
          this.data.passwordResets[row.id].used = true;
        }
        this.scheduleSave();
        return { success: true };
      } catch (err: any) {
        console.error('[DATABASE] PostgreSQL verify reset error:', err?.message || err);
      }
    }

    // In-memory / persistent JSON fallback
    const matching = Object.values(this.data.passwordResets)
      .filter((r) => r.userId === userId && r.tokenHash === tokenHash)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!matching) {
      return { success: false, error: 'Invalid or expired 6-digit reset code.' };
    }

    if (matching.used) {
      return { success: false, error: 'This reset code has already been used. Please request a new code.' };
    }

    if (now > matching.expiresAt) {
      return { success: false, error: 'This reset code has expired. Please request a new code.' };
    }

    matching.used = true;
    this.scheduleSave();
    return { success: true };
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
    const user = this.data.users[userId];
    if (!user) return false;

    const newHash = hashPassword(newPassword);
    user.passwordHash = newHash;

    // Invalidate all active sessions across all devices for this user
    this.revokeAllUserSessions(userId);

    if (this.pgPool) {
      try {
        await this.pgPool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
      } catch (pgErr: any) {
        console.error('[DATABASE] Error updating password in PostgreSQL:', pgErr?.message || pgErr);
      }
    }

    this.scheduleSave();
    return true;
  }

  // ----------------------------------------------------
  // Email Verification Management (24-hr Token Link, 15-min Code, Max 5 attempts)
  // ----------------------------------------------------
  setVerificationDetails(
    userId: string,
    code: string,
    token: string,
    codeTtlMinutes = 15,
    tokenTtlHours = 24
  ): void {
    const user = this.data.users[userId];
    if (user) {
      user.verificationCode = code;
      user.verificationExpiresAt = Date.now() + codeTtlMinutes * 60 * 1000;
      user.verificationAttempts = 0;
      user.verificationToken = token;
      user.verificationTokenExpiresAt = Date.now() + tokenTtlHours * 60 * 60 * 1000;

      if (this.pgPool) {
        this.pgPool
          .query(
            `UPDATE users 
             SET verification_code = $1, 
                 verification_expires_at = $2, 
                 verification_attempts = 0,
                 verification_token = $3,
                 verification_token_expires_at = $4
             WHERE id = $5`,
            [code, user.verificationExpiresAt, token, user.verificationTokenExpiresAt, userId]
          )
          .catch((err) => console.error('[DATABASE] Error updating verification details:', err?.message || err));
      }
      this.scheduleSave();
    }
  }

  setVerificationCode(userId: string, code: string, ttlMinutes = 15): void {
    const fallbackToken = crypto.randomBytes(32).toString('hex');
    this.setVerificationDetails(userId, code, fallbackToken, ttlMinutes, 24);
  }

  verifyEmailCode(userId: string, code: string): { success: boolean; error?: string } {
    const user = this.data.users[userId];
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    if (user.isVerified) {
      return { success: true };
    }

    if (!user.verificationCode || !user.verificationExpiresAt) {
      return { success: false, error: 'No verification code requested. Please request a new code.' };
    }

    if (Date.now() > user.verificationExpiresAt) {
      delete user.verificationCode;
      delete user.verificationExpiresAt;
      this.scheduleSave();
      return { success: false, error: 'Verification code has expired. Please request a new one.' };
    }

    user.verificationAttempts = (user.verificationAttempts || 0) + 1;

    if (user.verificationAttempts > 5) {
      delete user.verificationCode;
      delete user.verificationExpiresAt;
      user.verificationAttempts = 0;
      this.scheduleSave();
      return { success: false, error: 'Too many incorrect attempts. Please request a fresh verification code.' };
    }

    const cleanInput = code.trim();
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(cleanInput.padEnd(6, ' ')),
      Buffer.from(user.verificationCode.padEnd(6, ' '))
    );

    if (!isMatch) {
      this.scheduleSave();
      return {
        success: false,
        error: `Incorrect verification code (${5 - user.verificationAttempts} attempts remaining).`,
      };
    }

    // Success
    user.isVerified = true;
    delete user.verificationCode;
    delete user.verificationExpiresAt;
    delete user.verificationToken;
    delete user.verificationTokenExpiresAt;
    user.verificationAttempts = 0;

    if (this.pgPool) {
      this.pgPool
        .query(
          `UPDATE users 
           SET is_verified = TRUE,
               verification_code = NULL,
               verification_expires_at = NULL,
               verification_attempts = 0,
               verification_token = NULL,
               verification_token_expires_at = NULL
           WHERE id = $1`,
          [user.id]
        )
        .catch((err) => console.error('[DATABASE] Error updating is_verified in PostgreSQL:', err?.message || err));
    }

    this.scheduleSave();
    return { success: true };
  }

  markUserVerified(userId: string): PrivateUserRecord | null {
    const user = this.getUserById(userId);
    if (!user) return null;

    user.isVerified = true;
    delete user.verificationCode;
    delete user.verificationExpiresAt;
    delete user.verificationToken;
    delete user.verificationTokenExpiresAt;
    user.verificationAttempts = 0;

    if (this.pgPool) {
      this.pgPool
        .query(
          `UPDATE users 
           SET is_verified = TRUE,
               verification_code = NULL,
               verification_expires_at = NULL,
               verification_attempts = 0,
               verification_token = NULL,
               verification_token_expires_at = NULL
           WHERE id = $1`,
          [user.id]
        )
        .catch((err) => console.error('[DATABASE] Error updating is_verified in PostgreSQL:', err?.message || err));
    }

    this.scheduleSave();
    return user;
  }

  async verifyByToken(token: string): Promise<{ success: boolean; user?: PrivateUserRecord; error?: string }> {
    if (!token || typeof token !== 'string') {
      return { success: false, error: 'Verification token is required.' };
    }
    const cleanToken = token.trim();
    const now = Date.now();

    // Check Postgres if pool is connected
    if (this.pgPool) {
      try {
        const res = await this.pgPool.query(
          `SELECT * FROM users WHERE verification_token = $1 LIMIT 1`,
          [cleanToken]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          let user = this.data.users[row.id];
          if (!user) {
            this.data.users[row.id] = {
              id: row.id,
              email: row.email,
              passwordHash: row.password_hash,
              displayName: row.display_name,
              isVerified: Boolean(row.is_verified),
              role: row.role,
              status: row.status,
              safetyAcknowledged: Boolean(row.safety_acknowledged),
              isVolunteer: Boolean(row.is_volunteer),
              volunteerActive: Boolean(row.volunteer_active),
              createdAt: Number(row.created_at),
              blockedUserIds: [],
              recentPartnerIds: [],
              isAgeConfirmed: Boolean(row.is_age_confirmed),
              verificationToken: row.verification_token,
              verificationTokenExpiresAt: row.verification_token_expires_at ? Number(row.verification_token_expires_at) : undefined,
            };
            user = this.data.users[row.id];
          }

          if (user.isVerified) {
            return { success: true, user };
          }

          if (row.verification_token_expires_at && Number(row.verification_token_expires_at) < now) {
            return { success: false, error: 'This verification link has expired (24-hour limit). Please request a new one.' };
          }

          user.isVerified = true;
          delete user.verificationCode;
          delete user.verificationExpiresAt;
          delete user.verificationToken;
          delete user.verificationTokenExpiresAt;
          user.verificationAttempts = 0;

          await this.pgPool.query(
            `UPDATE users 
             SET is_verified = TRUE,
                 verification_code = NULL,
                 verification_expires_at = NULL,
                 verification_attempts = 0,
                 verification_token = NULL,
                 verification_token_expires_at = NULL
             WHERE id = $1`,
            [user.id]
          );
          this.scheduleSave();
          return { success: true, user };
        }
      } catch (err: any) {
        console.error('[DATABASE] PostgreSQL verifyByToken query error:', err?.message || err);
      }
    }

    // In-memory lookup fallback
    const user = Object.values(this.data.users).find((u) => u.verificationToken === cleanToken);
    if (!user) {
      return { success: false, error: 'Invalid or expired verification link. Please request a new link.' };
    }

    if (user.isVerified) {
      return { success: true, user };
    }

    if (user.verificationTokenExpiresAt && now > user.verificationTokenExpiresAt) {
      delete user.verificationToken;
      delete user.verificationTokenExpiresAt;
      this.scheduleSave();
      return { success: false, error: 'This verification link has expired (24-hour limit). Please request a new link.' };
    }

    user.isVerified = true;
    delete user.verificationCode;
    delete user.verificationExpiresAt;
    delete user.verificationToken;
    delete user.verificationTokenExpiresAt;
    user.verificationAttempts = 0;
    this.scheduleSave();
    return { success: true, user };
  }

  // ----------------------------------------------------
  // Genuine Conversation Session Verification & Mutual Friendship
  // ----------------------------------------------------
  recordCompletedSession(
    sessionId: string,
    user1Id: string,
    user2Id: string,
    startedAt: number
  ): CompletedSessionRecord {
    const now = Date.now();
    const durationSeconds = Math.max(1, Math.round((now - startedAt) / 1000));
    const serverSignature = signCompletedSession(sessionId, user1Id, user2Id, now);
    const session: CompletedSessionRecord = {
      sessionId,
      user1Id,
      user2Id,
      startedAt,
      endedAt: now,
      durationSeconds,
      choices: {},
      friendshipCreated: false,
      expiresAt: now + 15 * 60 * 1000, // Valid for post-chat choices for 15 minutes
      serverSignature,
    };
    this.data.completedSessions[sessionId] = session;
    this.incrementCompletedConversations();
    this.scheduleSave();
    return session;
  }

  getCompletedSession(sessionId: string): CompletedSessionRecord | undefined {
    return this.data.completedSessions[sessionId];
  }

  recordPostChatChoice(
    sessionId: string,
    userId: string,
    partnerId: string,
    wantsToTalkAgain: boolean,
    sessionSignature?: string
  ): { success: boolean; error?: string; mutual: boolean } {
    const session = this.data.completedSessions[sessionId];
    if (!session) {
      return { success: false, error: 'Invalid or unverified conversation session.', mutual: false };
    }

    if (Date.now() > session.expiresAt) {
      return { success: false, error: 'Choice window for this conversation has expired.', mutual: false };
    }

    // Verify server-signed session ID
    if (session.serverSignature) {
      if (!sessionSignature) {
        return {
          success: false,
          error: 'A valid, server-signed session ID is required to record friendship choice.',
          mutual: false,
        };
      }
      const isValid =
        sessionSignature === session.serverSignature ||
        verifyCompletedSessionSignature(sessionId, session.user1Id, session.user2Id, sessionSignature);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid or forged conversation session signature.',
          mutual: false,
        };
      }
    }

    // Verify participants
    const isUser1 = session.user1Id === userId;
    const isUser2 = session.user2Id === userId;
    if (!isUser1 && !isUser2) {
      return { success: false, error: 'Unauthorized: Not a participant in this conversation.', mutual: false };
    }

    const expectedPartnerId = isUser1 ? session.user2Id : session.user1Id;
    if (partnerId !== expectedPartnerId) {
      return { success: false, error: 'Mismatched conversation partner.', mutual: false };
    }

    // Check duplicate submission
    if (session.choices[userId] !== undefined) {
      return { success: false, error: 'Choice has already been submitted for this conversation.', mutual: false };
    }

    session.choices[userId] = wantsToTalkAgain;

    // Check if partner also consented
    const partnerChoice = session.choices[partnerId];
    if (wantsToTalkAgain && partnerChoice === true) {
      this.addFriendship(userId, partnerId);
      session.friendshipCreated = true;
      this.scheduleSave();
      return { success: true, mutual: true };
    }

    this.scheduleSave();
    return { success: true, mutual: false };
  }

  preApproveCompletedSession(sessionId: string, botUserId: string): boolean {
    const session = this.data.completedSessions[sessionId];
    if (!session) return false;
    session.choices[botUserId] = true;
    this.scheduleSave();
    return true;
  }

  ensureBotUser(botRecord: PrivateUserRecord) {
    const existing = this.data.users[botRecord.id];
    if (!existing) {
      this.data.users[botRecord.id] = botRecord;
      if (this.pgPool) {
        this.pgPool
          .query(
            `INSERT INTO users (id, email, password_hash, display_name, is_verified, is_age_confirmed, role, status, safety_acknowledged, is_volunteer, volunteer_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO NOTHING`,
            [
              botRecord.id,
              botRecord.email,
              botRecord.passwordHash,
              botRecord.displayName,
              true,
              true,
              'user',
              'available',
              true,
              false,
              false,
              new Date(botRecord.createdAt),
            ]
          )
          .catch((err) => console.error('[SIMULATOR] Failed to seed bot in Postgres:', err));
      }
    } else {
      existing.status = 'available';
      existing.suspendedUntil = undefined;
      existing.restrictionReason = undefined;
      existing.violationCount = 0;
      if (this.pgPool) {
        this.pgPool
          .query(
            `UPDATE users SET status = 'available', suspended_until = NULL, restriction_reason = NULL, violation_count = 0 WHERE id = $1`,
            [botRecord.id]
          )
          .catch((err) => console.error('[SIMULATOR] Error resetting bot in Postgres:', err));
      }
    }
    this.scheduleSave();
  }

  // ----------------------------------------------------
  // Friendship Management
  // ----------------------------------------------------
  getFriendshipsForUser(userId: string): Friendship[] {
    const list: Friendship[] = [];
    for (const f of Object.values(this.data.friendships)) {
      if (f.user1Id === userId) {
        const partner = this.data.users[f.user2Id];
        if (partner && !this.data.users[userId]?.blockedUserIds.includes(partner.id)) {
          list.push({
            id: f.id,
            partnerId: partner.id,
            partnerDisplayName: partner.displayName,
            createdAt: f.createdAt,
          });
        }
      } else if (f.user2Id === userId) {
        const partner = this.data.users[f.user1Id];
        if (partner && !this.data.users[userId]?.blockedUserIds.includes(partner.id)) {
          list.push({
            id: f.id,
            partnerId: partner.id,
            partnerDisplayName: partner.displayName,
            createdAt: f.createdAt,
          });
        }
      }
    }
    return list;
  }

  addFriendship(user1Id: string, user2Id: string): boolean {
    if (user1Id === user2Id) return false;
    for (const f of Object.values(this.data.friendships)) {
      if (
        (f.user1Id === user1Id && f.user2Id === user2Id) ||
        (f.user1Id === user2Id && f.user2Id === user1Id)
      ) {
        return true;
      }
    }
    const id = 'fr_' + crypto.randomBytes(8).toString('hex');
    this.data.friendships[id] = {
      id,
      user1Id,
      user2Id,
      createdAt: Date.now(),
    };
    this.scheduleSave();
    return true;
  }

  removeFriendship(user1Id: string, user2Id: string) {
    for (const [id, f] of Object.entries(this.data.friendships)) {
      if (
        (f.user1Id === user1Id && f.user2Id === user2Id) ||
        (f.user1Id === user2Id && f.user2Id === user1Id)
      ) {
        delete this.data.friendships[id];
      }
    }
    this.scheduleSave();
  }

  // ----------------------------------------------------
  // Server-Authoritative Blocking
  // ----------------------------------------------------
  blockUser(userId: string, targetUserId: string) {
    const user = this.data.users[userId];
    if (user && !user.blockedUserIds.includes(targetUserId)) {
      user.blockedUserIds.push(targetUserId);
      this.removeFriendship(userId, targetUserId);
      this.scheduleSave();
    }
  }

  unblockUser(userId: string, targetUserId: string) {
    const user = this.data.users[userId];
    if (user) {
      user.blockedUserIds = user.blockedUserIds.filter((id) => id !== targetUserId);
      this.scheduleSave();
    }
  }

  isBlockedEitherWay(userA: string, userB: string): boolean {
    const a = this.data.users[userA];
    const b = this.data.users[userB];
    if (a && a.blockedUserIds.includes(userB)) return true;
    if (b && b.blockedUserIds.includes(userA)) return true;
    return false;
  }

  // ----------------------------------------------------
  // Progressive Moderation & Ban Evasion Resistance
  // ----------------------------------------------------
  isUserSuspendedOrBanned(
    userId: string
  ): { isRestricted: boolean; status: string; reason?: string; remainingHours?: number } {
    const user = this.getUserById(userId);
    if (!user) {
      return { isRestricted: true, status: 'not_found' };
    }
    if (user.status === 'banned') {
      return {
        isRestricted: true,
        status: 'banned',
        reason: user.restrictionReason || 'Account permanently removed for violating community guidelines.',
      };
    }
    if (user.status === 'suspended') {
      const remainingMs = (user.suspendedUntil || 0) - Date.now();
      const remainingHours = Math.max(1, Math.ceil(remainingMs / 3600000));
      return {
        isRestricted: true,
        status: 'suspended',
        reason: user.restrictionReason || `Account suspended (${remainingHours}h remaining).`,
        remainingHours,
      };
    }
    if (user.status === 'restricted') {
      return {
        isRestricted: true,
        status: 'restricted',
        reason: user.restrictionReason || 'Account restricted pending review.',
      };
    }
    return { isRestricted: false, status: user.status };
  }

  applyProgressiveSuspension(
    userId: string,
    reason: string,
    evidenceSnippet: string,
    isSeverePredatory = false
  ): {
    user: PrivateUserRecord;
    record: ModerationRecord;
    penalty: '30_day_suspension' | '90_day_suspension' | 'permanent_ban';
  } {
    const user = this.data.users[userId];
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const currentViolations = user.violationCount || 0;
    let penalty: '30_day_suspension' | '90_day_suspension' | 'permanent_ban';
    const now = Date.now();

    if (isSeverePredatory || currentViolations >= 2) {
      // Permanent ban
      penalty = 'permanent_ban';
      user.status = 'banned';
      delete user.suspendedUntil;
      user.restrictionReason = reason || 'Account permanently removed for severe or repeated violations.';
      user.violationCount = currentViolations + 1;
      this.revokeAllUserSessions(userId);

      // Record IP for anti-evasion if known
      if (user.registeredIp) {
        this.recordBannedIp(user.registeredIp, 'Permanent ban: ' + reason);
      }
    } else if (currentViolations === 1) {
      // 90-day suspension
      penalty = '90_day_suspension';
      user.status = 'suspended';
      user.suspendedUntil = now + 90 * 24 * 60 * 60 * 1000;
      user.restrictionReason = reason || 'Account suspended for 90 days due to repeated violations.';
      user.violationCount = 2;
      this.revokeAllUserSessions(userId);
    } else {
      // 30-day suspension
      penalty = '30_day_suspension';
      user.status = 'suspended';
      user.suspendedUntil = now + 30 * 24 * 60 * 60 * 1000;
      user.restrictionReason = reason || 'Account suspended for 30 days for violating Someone’s rules.';
      user.violationCount = 1;
      this.revokeAllUserSessions(userId);
    }

    const recordId = 'mod_' + crypto.randomBytes(8).toString('hex');
    const record: ModerationRecord = {
      id: recordId,
      userId,
      timestamp: now,
      reason,
      evidenceSnippet,
      penalty,
      suspendedUntil: user.suspendedUntil,
    };

    this.data.moderationRecords[recordId] = record;
    this.scheduleSave();

    return { user, record, penalty };
  }

  recordBannedIp(ip: string, reason: string): void {
    const cleanIp = ip.trim();
    if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1') return;
    this.data.bannedIps[cleanIp] = {
      ip: cleanIp,
      reason,
      createdAt: Date.now(),
    };
    this.scheduleSave();
  }

  isIpBanned(ip: string): boolean {
    const cleanIp = ip.trim();
    return !!this.data.bannedIps[cleanIp];
  }

  getAllModerationRecords(): ModerationRecord[] {
    return Object.values(this.data.moderationRecords).sort((a, b) => b.timestamp - a.timestamp);
  }

  // ----------------------------------------------------
  // Reports
  // ----------------------------------------------------
  createReport(
    reporterId: string,
    reportedUserId: string,
    category: ReportRecord['category'],
    details: string,
    roomId?: string,
    evidenceSnippet?: string
  ): ReportRecord {
    const id = 'rep_' + crypto.randomBytes(8).toString('hex');
    const reportedUser = this.data.users[reportedUserId];
    const report: ReportRecord = {
      id,
      reporterId,
      reportedUserId,
      reportedDisplayName: reportedUser ? reportedUser.displayName : 'Unknown',
      roomId,
      category,
      details,
      evidenceSnippet,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.data.reports[id] = report;
    this.scheduleSave();
    return report;
  }

  getAllReports(): ReportRecord[] {
    return Object.values(this.data.reports).sort((a, b) => b.createdAt - a.createdAt);
  }

  updateReportStatus(
    id: string,
    status: ReportRecord['status'],
    reviewedBy: string,
    actionTaken?: string
  ): ReportRecord | undefined {
    const rep = this.data.reports[id];
    if (!rep) return undefined;
    rep.status = status;
    rep.reviewedBy = reviewedBy;
    if (actionTaken) rep.actionTaken = actionTaken;
    this.scheduleSave();
    return rep;
  }

  // ----------------------------------------------------
  // Moderation Flags
  // ----------------------------------------------------
  addFlag(flag: Omit<ModerationFlagRecord, 'id' | 'timestamp' | 'reviewed'>): ModerationFlagRecord {
    const id = 'flg_' + crypto.randomBytes(8).toString('hex');
    const record: ModerationFlagRecord = {
      ...flag,
      id,
      timestamp: Date.now(),
      reviewed: false,
    };
    this.data.flags[id] = record;
    this.scheduleSave();
    return record;
  }

  getAllFlags(): ModerationFlagRecord[] {
    return Object.values(this.data.flags).sort((a, b) => b.timestamp - a.timestamp);
  }

  markFlagReviewed(id: string) {
    if (this.data.flags[id]) {
      this.data.flags[id].reviewed = true;
      this.scheduleSave();
    }
  }

  // ----------------------------------------------------
  // Appeals
  // ----------------------------------------------------
  createAppeal(userId: string, reason: string): AppealRecord {
    const id = 'app_' + crypto.randomBytes(8).toString('hex');
    const user = this.data.users[userId];
    const appeal: AppealRecord = {
      id,
      userId,
      userEmail: user ? user.email : '',
      userDisplayName: user ? user.displayName : '',
      reason,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.data.appeals[id] = appeal;
    this.scheduleSave();
    return appeal;
  }

  getAllAppeals(): AppealRecord[] {
    return Object.values(this.data.appeals).sort((a, b) => b.createdAt - a.createdAt);
  }

  resolveAppeal(id: string, status: 'approved' | 'rejected', adminNote?: string): AppealRecord | undefined {
    const app = this.data.appeals[id];
    if (!app) return undefined;
    app.status = status;
    app.reviewedAt = Date.now();
    app.adminNote = adminNote;
    if (status === 'approved') {
      const user = this.data.users[app.userId];
      if (user) {
        user.status = 'offline';
        delete user.restrictionReason;
        delete user.suspendedUntil;
      }
    }
    this.scheduleSave();
    return app;
  }

  incrementCompletedConversations() {
    this.data.conversationsCompletedCount++;
    this.scheduleSave();
  }

  getCompletedConversationsCount(): number {
    return this.data.conversationsCompletedCount || 0;
  }

  getAllUsersList(): PrivateUserRecord[] {
    return Object.values(this.data.users);
  }

  /**
   * Gracefully drains the PostgreSQL connection pool and flushes pending writes
   */
  async close(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    try {
      await this.persistData();
    } catch (err) {
      console.error('[DATABASE] Error persisting data during shutdown:', err);
    }

    if (this.pgPool) {
      try {
        await this.pgPool.end();
        console.log('[DATABASE] PostgreSQL connection pool drained and closed cleanly.');
      } catch (err) {
        console.error('[DATABASE] Error draining PostgreSQL pool:', err);
      }
    }
  }
}

export const db = new Storage();
