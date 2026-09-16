/**
 * Ephemeral client-side blocked participant storage.
 * Stores ephemeral identifiers / hashes in localStorage & sessionStorage to prevent
 * reported or blocked participants from matching again in the same queue session.
 */

const BLOCKED_STORAGE_KEY = 'someone_blocked_ephemeral_ids';

/**
 * Returns set of blocked participant IDs from local/session storage.
 */
export function getEphemeralBlockedIds(): string[] {
  try {
    const rawLocal = localStorage.getItem(BLOCKED_STORAGE_KEY);
    const rawSession = sessionStorage.getItem(BLOCKED_STORAGE_KEY);
    const localIds: string[] = rawLocal ? JSON.parse(rawLocal) : [];
    const sessionIds: string[] = rawSession ? JSON.parse(rawSession) : [];
    const combined = Array.from(new Set([...localIds, ...sessionIds]));
    return combined;
  } catch {
    return [];
  }
}

/**
 * Persists a blocked participant ID into both localStorage and sessionStorage.
 */
export function addEphemeralBlockedId(userId: string): void {
  if (!userId) return;
  try {
    const current = getEphemeralBlockedIds();
    if (!current.includes(userId)) {
      current.push(userId);
      const serialized = JSON.stringify(current);
      localStorage.setItem(BLOCKED_STORAGE_KEY, serialized);
      sessionStorage.setItem(BLOCKED_STORAGE_KEY, serialized);
    }
  } catch (err) {
    console.warn('[BlockStorage] Failed to store blocked id:', err);
  }
}

/**
 * Checks if a given partner ID is blocked in client-side ephemeral storage.
 */
export function isEphemeralBlocked(userId: string): boolean {
  if (!userId) return false;
  const list = getEphemeralBlockedIds();
  return list.includes(userId);
}
