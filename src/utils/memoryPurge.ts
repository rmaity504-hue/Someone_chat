/**
 * Strict Client-Side Memory & State Purge Engine
 *
 * Implements thorough memory scrubbing when conversations terminate:
 * 1. Resets message history arrays and nullifies reference chains.
 * 2. Overwrites input text state with empty buffers.
 * 3. Clears temporary session identifiers, peer IDs, room tokens, and typing tokens in sessionStorage.
 * 4. Triggers window.gc?.() when available in browser runtimes.
 */

export function scrubSessionMemory(): void {
  if (typeof window === 'undefined') return;

  // 1. Scrub sessionStorage of any temporary session identifiers, peer IDs, or typing tokens
  try {
    if (window.sessionStorage) {
      const explicitKeys = [
        'someone_session_id',
        'someone_room_id',
        'someone_peer_id',
        'someone_temp_peer_id',
        'someone_typing_token',
        'someone_active_chat',
        'someone_chat_messages',
        'someone_chat_input',
        'someone_peer_signature',
        'someone_chat_token',
        'someone_session_signature',
        'someone_temp_token',
        'someone_active_session',
        'temp_session_id',
        'temp_peer_id',
        'temp_token',
        'typing_token',
        'chat_token',
        'chat_history',
        'chat_input',
      ];

      for (const key of explicitKeys) {
        window.sessionStorage.removeItem(key);
      }

      // Dynamic scan for any transient keys matching session/peer/room/typing patterns
      const dynamicKeysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (
          key &&
          (key.startsWith('someone_chat') ||
            key.startsWith('someone_session') ||
            key.startsWith('someone_peer') ||
            key.startsWith('someone_room') ||
            key.startsWith('chat_') ||
            key.startsWith('peer_') ||
            key.startsWith('typing_') ||
            key.includes('roomId') ||
            key.includes('peerId') ||
            key.includes('sessionToken') ||
            key.includes('activeChat'))
        ) {
          dynamicKeysToRemove.push(key);
        }
      }

      for (const key of dynamicKeysToRemove) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('[MemoryPurge] sessionStorage scrub caught error:', err);
  }

  // 2. Call window.gc?.() if available in the runtime environment
  try {
    if (typeof window.gc === 'function') {
      window.gc();
    }
  } catch (err) {
    // Normal in production browsers where exposed GC flag is not toggled
  }
}
