import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const SECRET_FILE_PATH = path.join(DATA_DIR, '.session_signing_secret');

/**
 * Resolves the session signing secret for HMAC-SHA256 signatures.
 *
 * NOTE FOR MULTI-SERVER PRODUCTION DEPLOYMENTS:
 * For multi-server / horizontal production environments, SESSION_SIGNING_SECRET MUST be set
 * in the host environment variables (e.g. via Cloud Run, Kubernetes, or .env) so that all
 * containers and instances share the exact same cryptographic HMAC key across restarts and load balancers.
 *
 * For single-server or local testing environments without an environment variable:
 * A stable, secure 256-bit secret is generated and stored locally in 'data/.session_signing_secret'
 * so user sessions, mutual friendship signatures, and session tokens remain valid across restarts.
 */
let secretWarned = false;

export function resolveSessionSigningSecret(): string {
  if (process.env.SESSION_SIGNING_SECRET && process.env.SESSION_SIGNING_SECRET.trim().length > 0) {
    return process.env.SESSION_SIGNING_SECRET.trim();
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(SECRET_FILE_PATH)) {
      const stored = fs.readFileSync(SECRET_FILE_PATH, 'utf-8').trim();
      if (stored.length >= 32) {
        if (!secretWarned) {
          console.warn(
            '[SECURITY NOTICE] SESSION_SIGNING_SECRET is not set in environment. Using persistent local fallback key from data/.session_signing_secret. For multi-server production, SESSION_SIGNING_SECRET must be set in the host environment.'
          );
          secretWarned = true;
        }
        return stored;
      }
    }

    // Generate new secure 256-bit random key
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE_PATH, generated, { encoding: 'utf-8', mode: 0o600 });
    if (!secretWarned) {
      console.warn(
        '[SECURITY WARNING] SESSION_SIGNING_SECRET was not provided in environment. Generated and saved a stable secret to data/.session_signing_secret. For multi-server production, SESSION_SIGNING_SECRET must be set in the host environment.'
      );
      secretWarned = true;
    }
    return generated;
  } catch (err) {
    if (!secretWarned) {
      console.warn(
        '[SECURITY WARNING] Failed to persist SESSION_SIGNING_SECRET to disk. Using ephemeral in-memory secret.',
        err
      );
      secretWarned = true;
    }
    return crypto.randomBytes(32).toString('hex');
  }
}

export const SESSION_SIGNING_SECRET = resolveSessionSigningSecret();

/**
 * Creates an HMAC-SHA256 signature for a completed conversation session between two users.
 */
export function signCompletedSession(sessionId: string, user1Id: string, user2Id: string, timestamp: number): string {
  const payload = `${sessionId}:${user1Id}:${user2Id}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', SESSION_SIGNING_SECRET).update(payload).digest('hex');
  return `${timestamp}.${hmac}`;
}

/**
 * Verifies an HMAC-SHA256 completed session signature to ensure both users actually completed
 * the designated conversation together within the allowable signature expiry window (15 minutes).
 */
export function verifyCompletedSessionSignature(
  sessionId: string,
  user1Id: string,
  user2Id: string,
  signature: string
): boolean {
  if (!signature || !signature.includes('.')) return false;
  const parts = signature.split('.');
  if (parts.length !== 2) return false;
  const timestamp = parseInt(parts[0], 10);
  const receivedHmac = parts[1];
  if (isNaN(timestamp)) return false;

  const now = Date.now();
  if (now - timestamp > 15 * 60 * 1000 || timestamp > now + 60 * 1000) {
    return false;
  }

  const payloadA = `${sessionId}:${user1Id}:${user2Id}:${timestamp}`;
  const payloadB = `${sessionId}:${user2Id}:${user1Id}:${timestamp}`;
  const hmacA = crypto.createHmac('sha256', SESSION_SIGNING_SECRET).update(payloadA).digest('hex');
  const hmacB = crypto.createHmac('sha256', SESSION_SIGNING_SECRET).update(payloadB).digest('hex');

  try {
    const receivedBuf = Buffer.from(receivedHmac, 'hex');
    const bufA = Buffer.from(hmacA, 'hex');
    const bufB = Buffer.from(hmacB, 'hex');
    if (receivedBuf.length !== 32) return false;
    return crypto.timingSafeEqual(receivedBuf, bufA) || crypto.timingSafeEqual(receivedBuf, bufB);
  } catch {
    return false;
  }
}
