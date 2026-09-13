import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';
import { db } from './server/db.js';
import { matchmaker } from './server/matchmaker.js';
import { evaluateMessageSafety } from './server/safety.js';
import { verifySmtpConnection } from './server/email.js';
import { REQUIRE_EMAIL_VERIFICATION } from './server/config.js';
import { simulator } from './server/simulator.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Cloud Run / Reverse Proxy header trust
  app.set('trust proxy', 1);

  app.use(express.json());

  // API Routes
  app.use('/api', apiRouter);

  // One-click email verification direct route
  app.get('/verify', (req, res) => {
    const token = req.query.token;
    if (token && typeof token === 'string') {
      res.redirect(`/api/auth/verify-email-link?token=${encodeURIComponent(token.trim())}`);
      return;
    }
    res.redirect('/');
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'Someone' });
  });

  const server = http.createServer(app);

  interface HardenedWebSocket extends WebSocket {
    isAlive: boolean;
    messageTimestamps: number[];
    authenticatedUserId: string | null;
  }

  // WebSocket Server on /ws with payload limit
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

  wss.on('error', (err) => {
    console.warn('[WSS WARN]', err?.message || err);
  });

  // 1. Server-side ping/pong heartbeat interval (30s) to automatically terminate dead or stale client connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      const extClient = client as HardenedWebSocket;
      if (extClient.isAlive === false) {
        if (extClient.authenticatedUserId) {
          console.log(`[WS HEARTBEAT] Terminating stale/unresponsive connection for user: ${extClient.authenticatedUserId}`);
          matchmaker.handleUserDisconnect(extClient.authenticatedUserId);
          matchmaker.unregisterClient(extClient.authenticatedUserId);
        }
        return client.terminate();
      }
      extClient.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const extWs = ws as HardenedWebSocket;
    extWs.isAlive = true;
    extWs.messageTimestamps = [];
    extWs.authenticatedUserId = null;

    ws.on('pong', () => {
      extWs.isAlive = true;
    });

    // Parse token from query string if available
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const userId = db.getUserIdByToken(token);
        if (userId) {
          // Immediately close socket if account is restricted, suspended, or banned
          const restriction = db.isUserSuspendedOrBanned(userId);
          if (restriction.isRestricted) {
            ws.send(JSON.stringify({ event: 'account:restricted', data: { reason: restriction.reason } }));
            ws.close(4003, (restriction.reason || 'Account restricted').slice(0, 100));
            return;
          }

          extWs.authenticatedUserId = userId;
          matchmaker.registerClient(userId, ws);
          ws.send(JSON.stringify({ event: 'auth:success', data: { userId } }));
        }
      }
    } catch (e) {
      console.warn('Error parsing ws url:', e);
    }

    ws.on('message', (raw) => {
      try {
        // Enforce maximum payload size limit (8KB)
        const rawLen = typeof raw === 'string' ? (raw as string).length : (raw as any)?.length || (raw as any)?.byteLength || 0;
        if (rawLen > 8192) {
          ws.send(JSON.stringify({ event: 'error', data: { message: 'Message payload size exceeds 8KB limit.' } }));
          return;
        }

        // Strict per-socket message rate limiting: maximum 5 messages per 2 seconds
        const now = Date.now();
        extWs.messageTimestamps = (extWs.messageTimestamps || []).filter((t) => now - t < 2000);
        if (extWs.messageTimestamps.length >= 5) {
          ws.send(
            JSON.stringify({
              event: 'error',
              data: { message: 'Rate limit exceeded: maximum 5 messages per 2 seconds. Please slow down.' },
            })
          );
          return;
        }
        extWs.messageTimestamps.push(now);

        const payload = JSON.parse(raw.toString());
        const { event, data } = payload;

        if (event === 'auth') {
          const { token } = data;
          const userId = db.getUserIdByToken(token);
          if (userId) {
            // Immediately close active sockets if account is restricted, suspended, or banned
            const restriction = db.isUserSuspendedOrBanned(userId);
            if (restriction.isRestricted) {
              ws.send(JSON.stringify({ event: 'account:restricted', data: { reason: restriction.reason } }));
              ws.close(4003, restriction.reason || 'Account restricted');
              return;
            }

            extWs.authenticatedUserId = userId;
            matchmaker.registerClient(userId, ws);
            ws.send(JSON.stringify({ event: 'auth:success', data: { userId } }));
          } else {
            ws.send(JSON.stringify({ event: 'auth:error', data: { message: 'Invalid session' } }));
          }
          return;
        }

        if (!extWs.authenticatedUserId) {
          ws.send(JSON.stringify({ event: 'error', data: { message: 'Not authenticated' } }));
          return;
        }

        const currentUserId = extWs.authenticatedUserId;

        // Check if account has been restricted, suspended, or banned during the session
        const statusCheck = db.isUserSuspendedOrBanned(currentUserId);
        if (statusCheck.isRestricted) {
          matchmaker.closeUserSockets(currentUserId, statusCheck.reason);
          return;
        }

        switch (event) {
          case 'heartbeat':
            matchmaker.updateHeartbeat(currentUserId);
            ws.send(JSON.stringify({ event: 'heartbeat:ack' }));
            break;

          case 'matching:enter':
            matchmaker.enterMatching(currentUserId);
            break;

          case 'matching:leave':
            matchmaker.leaveMatching(currentUserId);
            break;

          case 'matching:stay':
            matchmaker.stayAvailableInPool(currentUserId);
            break;

          case 'match:accept':
          case 'accept_match':
            if (data?.roomId) {
              matchmaker.acceptMatch(currentUserId, data.roomId);
            }
            break;

          case 'volunteer:respond':
            if (data?.offerId && data?.action) {
              matchmaker.respondToVolunteerOffer(data.offerId, currentUserId, data.action);
            }
            break;

          case 'chat:send':
            if (data?.roomId && typeof data?.text === 'string') {
              const text = data.text.trim();
              if (text.length === 0 || text.length > 2000) return;

              // Verify sender is genuinely in this active room
              if (!matchmaker.isUserInRoom(currentUserId, data.roomId)) {
                ws.send(
                  JSON.stringify({
                    event: 'chat:error',
                    data: { message: 'Unauthorized: not a participant in this conversation.' },
                  })
                );
                return;
              }

              // Verify sender is not suspended or banned
              const senderCheck = db.isUserSuspendedOrBanned(currentUserId);
              if (senderCheck.isRestricted) {
                ws.send(
                  JSON.stringify({
                    event: 'chat:blocked',
                    data: {
                      message: senderCheck.reason || 'Your account is currently suspended.',
                    },
                  })
                );
                return;
              }

              // Server-side safety assessment
              const safety = evaluateMessageSafety(text);

              if (safety.isViolating && safety.isSeriousSexualViolation) {
                // Immediate enforcement for clear serious violations:
                // 1. Prevent offending message from being delivered
                // 2. Immediately terminate current conversation
                // 3. Remove offending user from matching pool
                // 4. Suspend offending account for 30 days (progressive)
                // 5. Store private moderation record
                // 6. Inform offending user
                // 7. Do not reveal identity of innocent participant
                matchmaker.handleSafetyViolation(currentUserId, data.roomId, safety, text);
                return;
              }

              if (safety.isViolating) {
                const user = db.getUserById(currentUserId);
                // Record moderation flag
                db.addFlag({
                  userId: currentUserId,
                  displayName: user ? user.displayName : 'Unknown',
                  roomId: data.roomId,
                  triggerCategory: safety.category || 'violation',
                  flaggedText: text,
                  severity: safety.severity === 'severe' || safety.severity === 'high' ? 'high' : 'medium',
                });

                if (safety.severity === 'severe' || safety.severity === 'high') {
                  matchmaker.handleSafetyViolation(currentUserId, data.roomId, safety, text);
                  return;
                }
              }

              matchmaker.sendMessage(currentUserId, data.roomId, text);
            }
            break;

          case 'chat:disconnect':
            if (data?.roomId && matchmaker.isUserInRoom(currentUserId, data.roomId)) {
              matchmaker.endSession(data.roomId, 'Left the conversation');
            }
            break;

          case 'friendship:choice':
            if (data?.partnerId && typeof data?.wantsToTalkAgain === 'boolean') {
              matchmaker.submitFriendshipChoice(
                currentUserId,
                data.partnerId,
                data.wantsToTalkAgain,
                data.roomId,
                data.sessionSignature
              );
            }
            break;

          case 'report:create':
            if (data?.reportedUserId && data?.category && data?.details) {
              db.createReport(
                currentUserId,
                data.reportedUserId,
                data.category,
                data.details,
                data.roomId,
                data.evidenceSnippet
              );
              db.blockUser(currentUserId, data.reportedUserId);
              matchmaker.handleUserDisconnect(currentUserId);
              ws.send(JSON.stringify({ event: 'report:success' }));
            }
            break;

          case 'block:create':
            if (data?.targetUserId) {
              db.blockUser(currentUserId, data.targetUserId);
              matchmaker.handleUserDisconnect(currentUserId);
              ws.send(JSON.stringify({ event: 'block:success' }));
            }
            break;

          case 'simulator:match': {
            const user = db.getUserById(currentUserId);
            const isAdmin = Boolean(user?.role === 'admin' || (user as any)?.isAdmin);
            if (process.env.NODE_ENV === 'production' && !isAdmin) {
              ws.send(
                JSON.stringify({
                  event: 'error',
                  data: { message: 'Simulator disabled in production' },
                })
              );
              break;
            }
            matchmaker.createCompanionSession(currentUserId);
            break;
          }

          case 'simulator:action': {
            const user = db.getUserById(currentUserId);
            const isAdmin = Boolean(user?.role === 'admin' || (user as any)?.isAdmin);
            if (process.env.NODE_ENV === 'production' && !isAdmin) {
              ws.send(
                JSON.stringify({
                  event: 'error',
                  data: { message: 'Simulator disabled in production' },
                })
              );
              break;
            }
            if (data?.roomId && (data?.action === 'violation' || data?.action === 'clean_chat')) {
              matchmaker.simulateCompanionAction(currentUserId, data.roomId, data.action);
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (extWs.authenticatedUserId) {
        matchmaker.unregisterClient(extWs.authenticatedUserId, ws);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Someone server running on http://0.0.0.0:${PORT}`);
    console.log(`[AUTH CONFIG] Email verification required: ${REQUIRE_EMAIL_VERIFICATION}`);
    simulator.ensureBotUser();
    // Run Nodemailer startup check to verify SMTP connection and credentials
    verifySmtpConnection().catch((err) => {
      const errCode = err?.code ? `[${err.code}]` : '[UNKNOWN]';
      console.warn(`[SMTP NOTICE] Verification check: ${errCode} ${err?.message || err}`);
    });
  });

  // Graceful shutdown handling for container termination (SIGTERM, SIGINT)
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[SHUTDOWN] Received ${signal}. Initiating graceful shutdown...`);

    // 1. Cleanly terminate all active WebSocket connections with code 1001 (Going Away)
    try {
      matchmaker.closeAll(1001, 'Server shutting down (Going Away)');
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1001, 'Server shutting down (Going Away)');
        }
      }
      wss.close();
      console.log('[SHUTDOWN] WebSocket connections closed with status code 1001 (Going Away).');
    } catch (wsErr) {
      console.error('[SHUTDOWN] Error terminating WebSockets:', wsErr);
    }

    // 2. Stop accepting new HTTP requests
    server.close((err) => {
      if (err) {
        console.error('[SHUTDOWN] Error stopping HTTP server:', err);
      } else {
        console.log('[SHUTDOWN] HTTP server closed.');
      }
    });

    // 3. Drain and close PostgreSQL connection pool and flush pending saves
    try {
      await db.close();
    } catch (dbErr) {
      console.error('[SHUTDOWN] Error closing database connections:', dbErr);
    }

    console.log('[SHUTDOWN] Graceful shutdown complete. Exiting cleanly.');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
