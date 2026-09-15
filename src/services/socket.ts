/**
 * WebSocket service utility for dynamic URL resolution and singleton connection management.
 *
 * Ensures full compatibility with cloud platforms (Render, Cloud Run, Heroku) by:
 * 1. Dynamically inferring protocol (wss: over HTTPS, ws: over HTTP).
 * 2. Dynamically extracting host from window.location (no hardcoded localhost, 127.0.0.1, or dev ports).
 * 3. Appending auth session token to query string so authentication succeeds in partitioned-cookie,
 *    cross-origin, or incognito browser environments.
 * 4. Maintaining a persistent, resilient singleton connection that survives component navigation
 *    (MatchingView -> MatchFoundModal -> ChatView) without premature teardowns.
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

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
export type SocketEventHandler = (data: any) => void;
export type StatusChangeHandler = (status: SocketConnectionStatus) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private status: SocketConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private intentionalClose = false;
  private activeSessionId: string | null = null;
  private activeUserId: string | null = null;

  private listeners: Map<string, Set<SocketEventHandler>> = new Map();
  private statusListeners: Set<StatusChangeHandler> = new Set();
  private pendingQueue: Array<{ event: string; data?: any }> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        const storedToken = this.token || localStorage.getItem('someone_token');
        if (storedToken && (this.status === 'disconnected' || this.status === 'offline' || this.status === 'reconnecting')) {
          console.log('[WebSocket] Network back online, resuming connection...');
          this.retryNow();
        }
      });
    }
  }

  public getStatus(): SocketConnectionStatus {
    return this.status;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getMaxReconnectAttempts(): number {
    return this.maxReconnectAttempts;
  }

  public setActiveSessionInfo(sessionId: string | null, userId: string | null) {
    this.activeSessionId = sessionId;
    this.activeUserId = userId;
  }

  public clearActiveSessionInfo() {
    this.activeSessionId = null;
    this.activeUserId = null;
  }

  public getActiveSessionInfo(): { sessionId: string | null; userId: string | null } {
    return { sessionId: this.activeSessionId, userId: this.activeUserId };
  }

  public isConnected(): boolean {
    return this.status === 'connected' && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private setStatus(newStatus: SocketConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((fn) => {
        try {
          fn(newStatus);
        } catch (err) {
          console.error('[WebSocket] Error in status listener:', err);
        }
      });
    }
  }

  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusListeners.add(handler);
    handler(this.status);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  public connect(token: string, isRetry = false) {
    if (!token) return;

    // If already connected or connecting with identical token and not a forced retry, keep existing connection
    if (!isRetry && this.token === token && this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.setStatus('connected');
        return;
      }
      if (this.ws.readyState === WebSocket.CONNECTING) {
        this.setStatus('connecting');
        return;
      }
    }

    this.token = token;
    this.intentionalClose = false;
    this.cleanupSocket(false);

    const wsUrl = getWebSocketUrl(token);
    if (!wsUrl) return;

    if (!isRetry) {
      this.setStatus('connecting');
    }

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        console.log('[WebSocket] Connected securely to server.');

        // Initial auth payload as dual assurance
        try {
          socket.send(JSON.stringify({ event: 'auth', data: { token } }));
        } catch {
          // ignore
        }

        // Active session re-attachment:
        // If the user was in an active chat room when the connection dropped,
        // send a lightweight re-attach payload to immediately resume the session
        if (this.activeSessionId && this.activeUserId) {
          console.log(`[WebSocket] Sending re-attach payload for room ${this.activeSessionId}...`);
          try {
            const reattachPayload = {
              type: 'reconnect',
              sessionId: this.activeSessionId,
              userId: this.activeUserId,
            };
            socket.send(JSON.stringify(reattachPayload));
            socket.send(JSON.stringify({ event: 'reconnect', data: reattachPayload }));
          } catch (err) {
            console.error('[WebSocket] Failed to send re-attachment payload:', err);
          }
        }

        // Flush any messages queued during connection
        while (this.pendingQueue.length > 0) {
          const item = this.pendingQueue.shift();
          if (item) {
            this.send(item.event, item.data);
          }
        }

        // Start heartbeat ping every 15s
        this.startHeartbeat();
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type) {
            this.dispatch(payload.type, payload);
          }
          const { event: ev, data } = payload;
          if (ev) {
            this.dispatch(ev, data);
          }
        } catch (err) {
          console.warn('[WebSocket] Failed to parse message:', err);
        }
      };

      socket.onclose = (event) => {
        if (this.ws !== socket) return;
        console.log(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
        this.stopHeartbeat();

        // Do not auto-reconnect if closed intentionally or banned/restricted
        if (this.intentionalClose || event.code === 1000 || event.code === 4003) {
          this.setStatus('disconnected');
          return;
        }

        this.setStatus('reconnecting');
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // Handled cleanly via onclose
      };
    } catch (err) {
      console.error('[WebSocket] Connection creation error:', err);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws!.send(JSON.stringify({ event: 'heartbeat' }));
        } catch {
          // ignore
        }
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.intentionalClose || !this.token) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Maximum reconnect attempts: 5 attempts before notifying user of offline state
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[WebSocket] Reconnect attempts exhausted (${this.reconnectAttempts}/${this.maxReconnectAttempts}). Entering offline state.`);
      this.setStatus('offline');
      this.dispatch('connection:offline', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
      return;
    }

    // Base delay: 1000ms. Multiplier: 1.5x on consecutive failures up to ceiling of 10000ms (10s).
    const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    // Lightweight jitter (+- 300ms random) to prevent thundering-herd issues
    const jitter = Math.floor(Math.random() * 600) - 300;
    const delay = Math.max(200, Math.round(baseDelay + jitter));

    this.reconnectAttempts += 1;
    this.setStatus('reconnecting');
    console.log(`[WebSocket] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.dispatch('connection:reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose && this.token) {
        this.connect(this.token, true);
      }
    }, delay);
  }

  public retryNow() {
    this.cancelReconnect();
    this.reconnectAttempts = 0;
    this.intentionalClose = false;
    const activeToken = this.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('someone_token') : null);
    if (activeToken) {
      this.setStatus('reconnecting');
      this.connect(activeToken, true);
    }
  }

  public cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public disconnect(reason: string = 'Client disconnected') {
    this.intentionalClose = true;
    this.token = null;
    this.reconnectAttempts = 0;
    this.activeSessionId = null;
    this.activeUserId = null;
    this.cancelReconnect();
    this.cleanupSocket(true, reason);
    this.setStatus('disconnected');
    this.pendingQueue = [];
  }

  private cleanupSocket(callClose = true, reason = 'Closing') {
    this.stopHeartbeat();
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        if (callClose && socket.readyState === WebSocket.OPEN) {
          socket.close(1000, reason);
        }
      } catch {
        // ignore
      }
    }
  }

  public send(event: string, data?: any): boolean {
    const payload = JSON.stringify({ event, data });

    if (this.isConnected()) {
      try {
        this.ws!.send(payload);
        return true;
      } catch (err) {
        console.error('[WebSocket] Send failed:', err);
        return false;
      }
    }

    // Queue if currently connecting so messages are not lost during handshake
    if (this.status === 'connecting') {
      if (this.pendingQueue.length < 25) {
        this.pendingQueue.push({ event, data });
      }
      return true;
    }

    return false;
  }

  public on(event: string, handler: SocketEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.off(event, handler);
    };
  }

  public off(event: string, handler: SocketEventHandler) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  private dispatch(event: string, data: any) {
    const wildcardSet = this.listeners.get('*');
    if (wildcardSet) {
      wildcardSet.forEach((fn) => {
        try {
          fn({ event, data });
        } catch (err) {
          console.error(`[WebSocket] Error in wildcard handler:`, err);
        }
      });
    }

    const set = this.listeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error(`[WebSocket] Error in handler for event "${event}":`, err);
        }
      });
    }
  }
}

export const socketService = new SocketService();
