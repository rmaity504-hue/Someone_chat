-- Someone Database Schema (PostgreSQL)
-- Defines production storage for accounts, sessions, moderation, and relationship consent.
-- Does NOT retain ephemeral conversation transcripts.

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_code VARCHAR(16),
  verification_expires_at BIGINT,
  verification_attempts INT DEFAULT 0,
  verification_token VARCHAR(128),
  verification_token_expires_at BIGINT,
  is_age_confirmed BOOLEAN DEFAULT FALSE,
  role VARCHAR(32) DEFAULT 'user',
  status VARCHAR(32) DEFAULT 'offline',
  safety_acknowledged BOOLEAN DEFAULT FALSE,
  is_volunteer BOOLEAN DEFAULT FALSE,
  volunteer_active BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  last_login_at BIGINT,
  suspended_until BIGINT,
  restriction_reason TEXT,
  violation_count INT DEFAULT 0,
  registered_ip VARCHAR(64),
  banned_ips TEXT[] DEFAULT ARRAY[]::TEXT[],
  recent_partner_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  blocked_user_ids TEXT[] DEFAULT ARRAY[]::TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Ensure incremental columns exist on pre-existing users tables before index creation
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

-- 2. Sessions table (server-side revocable session tokens)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. Mutual Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id VARCHAR(64) PRIMARY KEY,
  user1_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  CONSTRAINT unique_mutual_friendship UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON friendships(user1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships(user2_id);

-- 4. Completed Sessions (for verifying post-conversation mutual consent)
CREATE TABLE IF NOT EXISTS completed_sessions (
  id VARCHAR(64) PRIMARY KEY, -- Room ID / Session ID
  user1_id VARCHAR(64) NOT NULL,
  user2_id VARCHAR(64) NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT NOT NULL,
  duration_seconds INT NOT NULL,
  user1_choice BOOLEAN,
  user2_choice BOOLEAN,
  friendship_created BOOLEAN DEFAULT FALSE,
  expires_at BIGINT NOT NULL,
  server_signature TEXT
);

ALTER TABLE completed_sessions ADD COLUMN IF NOT EXISTS server_signature TEXT;

CREATE INDEX IF NOT EXISTS idx_completed_sessions_expiry ON completed_sessions(expires_at);

-- 5. User Blocks
CREATE TABLE IF NOT EXISTS blocks (
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, blocked_user_id)
);

-- 6. Moderation and Safety Reports
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  reporter_id VARCHAR(64) NOT NULL,
  reported_user_id VARCHAR(64) NOT NULL,
  reported_display_name VARCHAR(64),
  room_id VARCHAR(64),
  category VARCHAR(64) NOT NULL,
  details TEXT NOT NULL,
  evidence_snippet TEXT,
  status VARCHAR(32) DEFAULT 'pending',
  reviewed_by VARCHAR(64),
  action_taken TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- 7. Moderation Flags (Automated Safety Signals)
CREATE TABLE IF NOT EXISTS moderation_flags (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  trigger_category VARCHAR(64) NOT NULL,
  flagged_text TEXT NOT NULL,
  severity VARCHAR(32) NOT NULL,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at BIGINT,
  timestamp BIGINT NOT NULL
);

-- 8. Persistent Moderation Records (Preserved for abuse prevention and ban enforcement)
CREATE TABLE IF NOT EXISTS moderation_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  evidence_snippet TEXT,
  penalty VARCHAR(64) NOT NULL,
  suspended_until BIGINT,
  timestamp BIGINT NOT NULL,
  automated BOOLEAN DEFAULT TRUE,
  appealed BOOLEAN DEFAULT FALSE,
  appeal_reason TEXT,
  appeal_status VARCHAR(32),
  appeal_reviewed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_mod_records_user ON moderation_records(user_id);

-- 9. Appeals
CREATE TABLE IF NOT EXISTS appeals (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  user_email VARCHAR(255),
  user_display_name VARCHAR(64),
  reason TEXT NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  admin_note TEXT,
  created_at BIGINT NOT NULL,
  reviewed_at BIGINT
);

-- 10. Banned Network Identifiers (IP hashes/subnets for anti-evasion)
CREATE TABLE IF NOT EXISTS banned_identifiers (
  id VARCHAR(64) PRIMARY KEY,
  identifier_type VARCHAR(32) NOT NULL, -- 'ip', 'subnet', 'fingerprint'
  identifier_hash VARCHAR(128) NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- 11. Password Reset Tokens
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

-- Note: Chat message bodies are intentionally NOT stored in any persistent table
-- to uphold Someone's core ephemeral text conversation principle.
