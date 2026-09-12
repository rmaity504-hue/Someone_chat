/**
 * WebSocket service utility for dynamic URL resolution and connection helper.
 *
 * Ensures full compatibility with cloud platforms (Render, Cloud Run, Heroku) by:
 * 1. Dynamically inferring protocol (wss: over HTTPS, ws: over HTTP).
 * 2. Dynamically extracting host from window.location (no hardcoded localhost, 127.0.0.1, or dev ports).
 * 3. Appending auth session token to query string so authentication succeeds in partitioned-cookie,
 *    cross-origin, or incognito browser environments.
 */

export function getWebSocketUrl(token?: string | null): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const baseUrl = `${protocol}//${host}/ws`;

  if (token) {
    return `${baseUrl}?token=${encodeURIComponent(token)}`;
  }
  return baseUrl;
}
