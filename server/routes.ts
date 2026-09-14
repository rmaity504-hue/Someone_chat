import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { db, hashPassword, verifyPassword, hashSecurityAnswer } from './db.js';
import { matchmaker } from './matchmaker.js';
import {
  sendDiagnosticTestEmail,
} from './email.js';
import { REQUIRE_EMAIL_VERIFICATION } from './config.js';
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
  sendNotificationToSubscription,
} from './pushNotifications.js';

export const apiRouter = express.Router();

function getAppBaseUrl(req: Request): string {
  const appUrlEnv = process.env.APP_URL?.replace(/\/+$/, '');
  const hostHeader = req.get('host');
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const requestBaseUrl = hostHeader ? `${protocol}://${hostHeader}` : '';
  return appUrlEnv && !appUrlEnv.includes('MY_APP_URL') ? appUrlEnv : requestBaseUrl;
}

// ----------------------------------------------------
// RATE LIMITERS FOR ABUSE MITIGATION
// ----------------------------------------------------

// 1. Registration limiter: max 5 accounts per hour per IP
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many account registrations from this network. Please try again later.' },
});

// 2. Login limiter: max 10 sign-in attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes before trying again.' },
});

// 3. Verification limiter: max 6 attempts per 15 minutes per IP
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many verification attempts. Please wait a few minutes before trying again.' },
});

// 3b. Forgot password limiter: max 3 reset requests per 15 minutes per IP
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many password reset requests. Please wait 15 minutes before trying again.' },
});

// 3c. Reset password limiter: max 5 reset submissions per 15 minutes per IP
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many reset attempts. Please wait 15 minutes before trying again.' },
});

// 4. Matching queue limiter: max 15 requests per minute per IP
const matchingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Matching queue requests are too frequent. Please wait a moment.' },
});

// 5. Reporting limiter: max 5 reports per 15 minutes per IP
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many reports submitted in a short window. Please wait a few minutes.' },
});

// 6. Friendship choice limiter: max 10 actions per minute
const friendshipLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many friendship requests. Please wait a moment.' },
});

// 7. Admin limiter: max 40 sensitive actions per minute
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Administrative rate limit exceeded.' },
});

// 8. Volunteer actions limiter: max 10 status changes per minute
const volunteerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many volunteer actions. Please wait a moment.' },
});

// ----------------------------------------------------
// AUTHENTICATION & AUTHORIZATION MIDDLEWARES
// ----------------------------------------------------

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = authHeader.slice(7);
  const userId = db.getUserIdByToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid, revoked, or expired session. Please sign in again.' });
    return;
  }
  const user = db.getUserById(userId);
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  (user as any).isAdmin = user.role === 'admin';
  (req as any).user = user;
  (req as any).token = token;
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

apiRouter.post(['/auth/register', '/register'], registrationLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password, displayName, isAgeConfirmed } = req.body;
  const securityQuestion = req.body.security_question || req.body.securityQuestion;
  const securityAnswer = req.body.security_answer || req.body.securityAnswer;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
    res.status(400).json({ error: 'Display name must be at least 2 characters.' });
    return;
  }
  if (!isAgeConfirmed) {
    res.status(400).json({ error: 'You must confirm you are 18 years of age or older.' });
    return;
  }
  if (!securityQuestion || typeof securityQuestion !== 'string' || securityQuestion.trim().length < 3) {
    res.status(400).json({ error: 'Please select or provide a security question.' });
    return;
  }
  if (!securityAnswer || typeof securityAnswer !== 'string' || securityAnswer.trim().length < 1) {
    res.status(400).json({ error: 'Please provide an answer to your security question.' });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  if (clientIp && db.isIpBanned(clientIp)) {
    res.status(403).json({ error: 'Access restricted due to previous severe policy violations.' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = db.getUserByEmail(cleanEmail);
  if (existing) {
    res.status(400).json({ error: 'An account with this email address already exists.' });
    return;
  }

  // Hash the normalized (trimmed, lowercase) security answer securely with bcrypt
  const answerHash = hashSecurityAnswer(securityAnswer);

  // Create user directly as active and verified
  const user = db.createUser(
    cleanEmail,
    hashPassword(password),
    displayName.trim(),
    clientIp,
    true,
    securityQuestion.trim(),
    answerHash
  );
  const token = db.createSession(user.id);

  res.json({
    ok: true,
    success: true,
    user: db.toPublicProfile(user),
    token,
  });
});

apiRouter.post(['/auth/login', '/login'], loginLimiter, (req: Request, res: Response): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  if (clientIp && db.isIpBanned(clientIp)) {
    res.status(403).json({ error: 'Access restricted due to previous severe policy violations.' });
    return;
  }

  const user = db.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (user.status === 'banned') {
    res.status(403).json({
      error: user.restrictionReason || 'This account has been permanently removed for policy violations.',
    });
    return;
  }

  // Ensure user is marked verified immediately
  if (!user.isVerified) {
    db.markUserVerified(user.id);
  }

  const token = db.createSession(user.id);
  const activeUser = db.getUserById(user.id) || user;
  res.json({
    ok: true,
    success: true,
    token,
    user: db.toPublicProfile(activeUser),
  });
});

apiRouter.get('/auth/me', authenticate, (req: Request, res: Response): void => {
  let user = (req as any).user;
  if (!user.isVerified) {
    user = db.markUserVerified(user.id) || user;
  }
  res.json({ user: db.toPublicProfile(user) });
});

// Legacy verification compatibility endpoints (always succeed without requiring OTP)
apiRouter.post(['/auth/verify-email', '/verify-email'], (req: Request, res: Response): void => {
  res.json({ success: true, message: 'Email verification is not required.' });
});

apiRouter.post('/auth/resend-verification', (req: Request, res: Response): void => {
  res.json({ success: true, message: 'Email verification is not required.' });
});

apiRouter.get(
  ['/auth/verify-email-link', '/auth/verify-link'],
  (req: Request, res: Response): void => {
    res.redirect('/');
  }
);

apiRouter.post(
  [
    '/auth/get-security-question',
    '/get-security-question',
    '/auth/forgot-password',
    '/forgot-password',
  ],
  forgotPasswordLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.getUserByEmail(cleanEmail);

    if (!user || user.status === 'banned') {
      res.status(404).json({ error: 'No security question configured for this account. Contact admin.' });
      return;
    }

    if (!user.securityQuestion || !user.securityAnswerHash) {
      res.status(400).json({
        error: 'No security question configured for this account. Contact admin.',
        hasSecurityQuestion: false,
      });
      return;
    }

    res.json({
      success: true,
      hasSecurityQuestion: true,
      question: user.securityQuestion,
    });
  }
);

apiRouter.post(
  [
    '/auth/reset-password-with-answer',
    '/reset-password-with-answer',
    '/auth/reset-password',
    '/reset-password',
  ],
  resetPasswordLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const email = req.body.email;
    const answer = req.body.answer || req.body.security_answer || req.body.securityAnswer;
    const newPassword = req.body.newPassword || req.body.new_password || req.body.password;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Please provide your account email address.' });
      return;
    }

    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      res.status(400).json({ error: 'Please provide the answer to your security question.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters in length.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.getUserByEmail(cleanEmail);
    if (!user || user.status === 'banned') {
      res.status(400).json({ error: 'Invalid password recovery request.' });
      return;
    }

    if (!user.securityQuestion || !user.securityAnswerHash) {
      res.status(400).json({
        error: 'No security question configured for this account. Contact admin.',
      });
      return;
    }

    const isAnswerCorrect = db.verifyUserSecurityAnswer(user.id, answer);
    if (!isAnswerCorrect) {
      res.status(400).json({ error: 'Incorrect answer to the security question. Please try again.' });
      return;
    }

    // Hash new password and update user credentials
    await db.updateUserPassword(user.id, newPassword);

    // Create session token to log them in immediately
    const token = db.createSession(user.id);

    res.json({
      success: true,
      token,
      user: db.toPublicProfile(user),
      message: 'Your password has been successfully reset. You are now signed in.',
    });
  }
);

// Authenticated route for users to set or update their security question & answer
apiRouter.post('/auth/security-question', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { question, answer } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    res.status(400).json({ error: 'Please select or enter a valid security question.' });
    return;
  }

  if (!answer || typeof answer !== 'string' || answer.trim().length < 2) {
    res.status(400).json({ error: 'Please provide an answer (minimum 2 characters).' });
    return;
  }

  const answerHash = hashSecurityAnswer(answer);
  await db.setSecurityQuestion(user.id, question.trim(), answerHash);

  const updatedUser = db.getUserById(user.id);
  res.json({
    success: true,
    message: 'Security question configured successfully.',
    user: db.toPublicProfile(updatedUser || user),
  });
});

apiRouter.post('/auth/acknowledge-safety', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const updated = db.updateUser(user.id, { safetyAcknowledged: true });
  res.json({ success: true, user: db.toPublicProfile(updated!) });
});

apiRouter.post('/auth/logout', authenticate, (req: Request, res: Response): void => {
  const token = (req as any).token;
  db.revokeSession(token);
  res.json({ success: true });
});

// ----------------------------------------------------
// DIAGNOSTIC HEALTH ENDPOINT FOR SMTP VERIFICATION
// ----------------------------------------------------
apiRouter.post(
  ['/auth/test-smtp', '/test-smtp'],
  async (req: Request, res: Response): Promise<void> => {
    try {
      // In production, diagnostic SMTP test is restricted to authenticated administrators
      if (process.env.NODE_ENV === 'production') {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          res.status(403).json({ ok: false, error: 'Diagnostic SMTP test is disabled in production for non-administrators.' });
          return;
        }
        const token = authHeader.substring(7);
        const userId = db.getUserIdByToken(token);
        if (!userId) {
          res.status(403).json({ ok: false, error: 'Diagnostic SMTP test is disabled in production for non-administrators.' });
          return;
        }
        const user = db.getUserById(userId);
        if (user?.role !== 'admin' && !(user as any)?.isAdmin) {
          res.status(403).json({ ok: false, error: 'Diagnostic SMTP test is restricted to administrators in production.' });
          return;
        }
      }

      const to = req.body?.to || req.query?.to;
      if (!to || typeof to !== 'string' || !to.includes('@')) {
        res.status(400).json({
          ok: false,
          error: 'Please provide a valid recipient email address in the "to" field (e.g. { "to": "test@example.com" }).',
          code: 'EBADREQUEST',
        });
        return;
      }

      console.log(`[SMTP DIAGNOSTIC] Initiating test email delivery to: ${to}`);
      const result = await sendDiagnosticTestEmail(to.trim());

      if (result.ok) {
        res.json({
          ok: true,
          messageId: result.messageId,
          response: result.response,
        });
      } else {
        res.json({
          ok: false,
          error: result.error,
          code: result.code,
          command: result.command,
        });
      }
    } catch (err: any) {
      console.error('[SMTP DIAGNOSTIC EXCEPTION]:', err);
      res.json({
        ok: false,
        error: err?.message || String(err),
        code: err?.code,
        command: err?.command,
      });
    }
  }
);

// ----------------------------------------------------
// SECURE ADMIN BOOTSTRAP (ONE-TIME PROVISIONING)
// ----------------------------------------------------

apiRouter.post('/admin/bootstrap', adminLimiter, (req: Request, res: Response): void => {
  const { email, password, displayName, bootstrapKey } = req.body;

  if (!email || !password || !bootstrapKey) {
    res.status(400).json({ error: 'Email, password, and bootstrapKey are required.' });
    return;
  }

  const result = db.bootstrapAdminAccount(email, password, displayName, bootstrapKey);
  if (!result.success) {
    res.status(403).json({ error: result.error || 'Bootstrap rejected.' });
    return;
  }

  res.json({ success: true, user: result.user });
});

// ----------------------------------------------------
// USER ACCOUNT PRIVACY & CONTROLLED DELETION
// ----------------------------------------------------

const handleDeleteAccount = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { password } = req.body || {};

  // If password confirmation was provided in the request body, verify it
  if (password && typeof password === 'string') {
    if (!verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Incorrect password confirmation.' });
      return;
    }
  }

  // Terminate active socket and remove from matching pool
  matchmaker.handleUserDisconnect(user.id);
  matchmaker.leaveMatching(user.id);
  matchmaker.closeUserSockets(user.id, 'Account deleted');

  // Perform server-side deletion (PostgreSQL tables, session revocation, memory cleanup)
  await db.deleteUserAccount(user.id);

  res.json({ success: true, message: 'Your account and personal data have been deleted.' });
};

apiRouter.delete('/users/me', authenticate, handleDeleteAccount);
apiRouter.delete('/user/me', authenticate, handleDeleteAccount);

// ----------------------------------------------------
// VOLUNTEER LISTENER AVAILABILITY
// ----------------------------------------------------

apiRouter.post('/volunteer/toggle', volunteerLimiter, authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const restriction = db.isUserSuspendedOrBanned(user.id);
  if (restriction.isRestricted) {
    res.status(403).json({ error: restriction.reason || 'Account is currently suspended or restricted.' });
    return;
  }

  if (!user.isVolunteer) {
    res.status(403).json({ error: 'Only designated trusted volunteers may toggle listener availability.' });
    return;
  }

  const { active } = req.body;
  const volunteerActive = Boolean(active);
  const updated = db.updateUser(user.id, {
    volunteerActive,
    status: volunteerActive ? 'volunteer_available' : 'offline',
  });

  res.json({ success: true, user: db.toPublicProfile(updated!) });
});

// ----------------------------------------------------
// WEB PUSH NOTIFICATIONS FOR ADMIN / LISTENERS
// ----------------------------------------------------

// Direct VAPID Public Key endpoints (/api/push/vapid-public-key and /api/notifications/vapid-public-key)
apiRouter.get('/push/vapid-public-key', (_req: Request, res: Response): void => {
  res.json({
    publicKey:
      process.env.VAPID_PUBLIC_KEY ||
      'BMzvZylzxhzL7LmFSW7Swj7GGariKK7WAWbk-Q2ESt1apjR2Ek9Rb1tfLSwoli3ww4IUfIlR1-VWATH1tAFJCBw',
  });
});

apiRouter.get('/notifications/vapid-public-key', (_req: Request, res: Response): void => {
  try {
    const key =
      process.env.VAPID_PUBLIC_KEY ||
      getVapidPublicKey() ||
      'BMzvZylzxhzL7LmFSW7Swj7GGariKK7WAWbk-Q2ESt1apjR2Ek9Rb1tfLSwoli3ww4IUfIlR1-VWATH1tAFJCBw';
    res.json({ publicKey: key });
  } catch (err: any) {
    res.json({
      publicKey:
        process.env.VAPID_PUBLIC_KEY ||
        'BMzvZylzxhzL7LmFSW7Swj7GGariKK7WAWbk-Q2ESt1apjR2Ek9Rb1tfLSwoli3ww4IUfIlR1-VWATH1tAFJCBw',
    });
  }
});

apiRouter.post('/notifications/subscribe', (req: Request, res: Response): void => {
  const { subscription, role } = req.body;
  if (
    !subscription ||
    !subscription.endpoint ||
    !subscription.keys ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    res.status(400).json({ error: 'Valid PushSubscription object with endpoint and keys is required.' });
    return;
  }

  // Check optional authorization header
  let userId: string | null = null;
  let userRole = role || 'listener';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const resolvedUserId = db.getUserIdByToken(token);
    if (resolvedUserId) {
      userId = resolvedUserId;
      const user = db.getUserById(resolvedUserId);
      if (user) {
        userRole = user.role;
      }
    }
  }

  const record = savePushSubscription(subscription, userId, userRole);
  res.json({ success: true, subscriptionId: record.id });
});

apiRouter.post('/notifications/unsubscribe', (req: Request, res: Response): void => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint is required to unsubscribe.' });
    return;
  }
  deletePushSubscription(endpoint);
  res.json({ success: true });
});

apiRouter.post('/notifications/test', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const userSubs = db.getPushSubscriptionsByUserId(user.id);
  if (userSubs.length === 0) {
    res.status(404).json({ error: 'No push subscription found for this account. Please enable notifications first.' });
    return;
  }

  let sent = 0;
  for (const sub of userSubs) {
    const ok = await sendNotificationToSubscription(sub, {
      title: 'Someone is awake',
      body: 'A visitor is waiting to talk. Tap to enter the conversation.',
      url: '/chat',
    });
    if (ok) sent++;
  }

  res.json({ success: true, sentCount: sent });
});

// ----------------------------------------------------
// MATCHING ACTIONS
// ----------------------------------------------------

apiRouter.post(['/matching/start', '/matchmaker/find'], matchingLimiter, authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const result = matchmaker.enterMatching(user.id);
  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }
  res.json({ success: true, message: 'Matching queue entered.' });
});

apiRouter.post('/matching/leave', matchingLimiter, authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  matchmaker.leaveMatching(user.id);
  res.json({ success: true });
});

// ----------------------------------------------------
// GENUINE POST-CONVERSATION FRIENDSHIP CONSENT
// ----------------------------------------------------

apiRouter.post(['/post-chat/choice', '/friendship/choice'], friendshipLimiter, authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { sessionId, partnerId, choice, sessionSignature } = req.body;

  if (!sessionId || !partnerId || typeof choice !== 'boolean') {
    res.status(400).json({ error: 'sessionId, partnerId, and boolean choice are required.' });
    return;
  }

  if (!sessionSignature || typeof sessionSignature !== 'string') {
    res.status(400).json({ error: 'A valid, server-signed completed conversation session ID is required.' });
    return;
  }

  const result = db.recordPostChatChoice(sessionId, user.id, partnerId, choice, sessionSignature);
  if (!result.success) {
    res.status(400).json({ error: result.error || 'Failed to record choice.' });
    return;
  }

  res.json({ success: true, mutual: result.mutual });
});

// ----------------------------------------------------
// SAFETY, REPORTING & BLOCKING
// ----------------------------------------------------

apiRouter.post(['/safety/report', '/report'], reportLimiter, authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { reportedUserId, category, details, roomId, evidenceSnippet } = req.body;

  if (!reportedUserId || !category || !details) {
    res.status(400).json({ error: 'Reported user ID, category, and details are required.' });
    return;
  }

  const report = db.createReport(
    user.id,
    reportedUserId,
    category,
    details.trim(),
    roomId,
    evidenceSnippet
  );

  // Record in moderation review flags
  const reportedUser = db.getUserById(reportedUserId);
  db.addFlag({
    userId: reportedUserId,
    displayName: reportedUser ? reportedUser.displayName : 'Unknown',
    roomId,
    triggerCategory: category,
    flaggedText: `User Report (${category}): ${details.trim()}` + (evidenceSnippet ? ` [Evidence: ${evidenceSnippet}]` : ''),
    severity: 'high',
  });

  // Auto-block the reported user immediately
  db.blockUser(user.id, reportedUserId);
  matchmaker.handleUserDisconnect(user.id);

  res.json({ success: true, reportId: report.id });
});

apiRouter.post('/safety/block', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { targetUserId } = req.body;

  if (!targetUserId) {
    res.status(400).json({ error: 'Target user ID is required.' });
    return;
  }

  db.blockUser(user.id, targetUserId);
  matchmaker.handleUserDisconnect(user.id);

  res.json({ success: true });
});

apiRouter.get('/safety/blocked', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const fullUser = db.getUserById(user.id);
  const blockedList = (fullUser?.blockedUserIds || []).map((id) => {
    const target = db.getUserById(id);
    return {
      id,
      displayName: target ? target.displayName : 'Former user',
    };
  });
  res.json({ blocked: blockedList });
});

apiRouter.post('/safety/unblock', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { targetUserId } = req.body;
  if (!targetUserId) {
    res.status(400).json({ error: 'Target user ID is required.' });
    return;
  }
  db.unblockUser(user.id, targetUserId);
  res.json({ success: true });
});

// ----------------------------------------------------
// CONNECTIONS / FRIENDS (MUTUAL CONSENT ONLY)
// ----------------------------------------------------

apiRouter.get(['/connections', '/friends'], authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const rawFriends = db.getFriendshipsForUser(user.id);
  const connections = rawFriends.map((f) => ({
    ...f,
    isOnline: matchmaker.isClientConnected(f.partnerId),
  }));
  res.json({ connections, friends: connections });
});

apiRouter.post(['/connections/start-chat', '/friends/start-chat'], authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { partnerId } = req.body;
  if (!partnerId) {
    res.status(400).json({ error: 'Partner ID is required.' });
    return;
  }
  const rawFriends = db.getFriendshipsForUser(user.id);
  const isFriend = rawFriends.some((f) => f.partnerId === partnerId);
  if (!isFriend) {
    res.status(403).json({ error: 'You can only start direct chats with mutual saved connections.' });
    return;
  }
  if (!matchmaker.isClientConnected(partnerId)) {
    res.status(400).json({ error: 'Partner is currently offline. You will be able to message when they are online.' });
    return;
  }
  const session = matchmaker.createDirectSession(user.id, partnerId);
  if (!session) {
    res.status(400).json({ error: 'Unable to start session right now.' });
    return;
  }
  res.json({ success: true, roomId: session.roomId });
});

apiRouter.post(['/connections/remove', '/friends/remove'], authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { friendId, partnerId } = req.body;
  const targetId = friendId || partnerId;
  if (!targetId) {
    res.status(400).json({ error: 'Partner ID is required.' });
    return;
  }
  db.removeFriendship(user.id, targetId);
  res.json({ success: true });
});

// ----------------------------------------------------
// APPEALS
// ----------------------------------------------------

apiRouter.post('/appeals/submit', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    res.status(400).json({ error: 'Please provide an explanation of at least 10 characters.' });
    return;
  }

  const appeal = db.createAppeal(user.id, reason.trim());
  res.json({ success: true, appeal });
});

apiRouter.get('/appeals/my', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const all = db.getAllAppeals();
  const mine = all.filter((a) => a.userId === user.id);
  res.json({ appeals: mine });
});

// ----------------------------------------------------
// PROTECTED ADMIN / MODERATOR DASHBOARD ROUTES
// ----------------------------------------------------

apiRouter.get('/admin/stats', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const allUsers = db.getAllUsersList();
  const reports = db.getAllReports();

  const stats = {
    totalUsers: allUsers.length,
    verifiedUsers: allUsers.filter((u) => u.isVerified).length,
    activeSockets: matchmaker.getActiveSocketsCount(),
    currentlyMatching: matchmaker.getWaitingCount(),
    activeConversations: matchmaker.getActiveSessionsCount(),
    availableVolunteers: allUsers.filter((u) => u.isVolunteer && u.volunteerActive).length,
    pendingReports: reports.filter((r) => r.status === 'pending').length,
    totalConversationsCompleted: db.getCompletedConversationsCount(),
    totalMutualFriendships: (db as any).data?.friendships ? Object.keys((db as any).data.friendships).length : 0,
  };

  res.json({ stats });
});

apiRouter.get('/admin/users', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const allUsers = db.getAllUsersList().map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    isVerified: u.isVerified,
    isVolunteer: u.isVolunteer,
    volunteerActive: u.volunteerActive,
    createdAt: u.createdAt,
    restrictionReason: u.restrictionReason,
    suspendedUntil: u.suspendedUntil,
    blockedCount: u.blockedUserIds?.length || 0,
  }));
  res.json({ users: allUsers });
});

apiRouter.get('/admin/reports', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const reports = db.getAllReports();
  res.json({ reports });
});

apiRouter.post('/admin/reports/:id/resolve', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { id } = req.params;
  const { status, actionTaken } = req.body;

  const rep = db.updateReportStatus(id, status, user.displayName, actionTaken);
  if (!rep) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json({ success: true, report: rep });
});

apiRouter.get('/admin/flags', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const flags = db.getAllFlags();
  res.json({ flags });
});

apiRouter.get('/admin/moderation-records', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const records = db.getAllModerationRecords();
  res.json({ records });
});

apiRouter.post('/admin/flags/:id/reviewed', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const { id } = req.params;
  db.markFlagReviewed(id);
  res.json({ success: true });
});

apiRouter.post('/admin/user/:id/action', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const { id } = req.params;
  const { action, reason, durationHours } = req.body;

  const target = db.getUserById(id);
  if (!target) {
    res.status(404).json({ error: 'Target user not found' });
    return;
  }

  if (action === 'warn') {
    db.updateUser(id, { restrictionReason: `Warning: ${reason || 'Inappropriate conduct'}` });
  } else if (action === 'restrict') {
    const restrictReason = reason || 'Temporary restriction due to safety reports.';
    db.updateUser(id, {
      status: 'restricted',
      restrictionReason: restrictReason,
    });
    matchmaker.closeUserSockets(id, restrictReason);
  } else if (action === 'suspend') {
    const hours = Number(durationHours) || 24;
    const suspendedUntil = Date.now() + hours * 3600000;
    const suspendReason = reason || `Suspended for ${hours} hours.`;
    db.updateUser(id, {
      status: 'suspended',
      suspendedUntil,
      restrictionReason: suspendReason,
    });
    matchmaker.closeUserSockets(id, suspendReason);
  } else if (action === 'ban') {
    const banReason = reason || 'Permanent removal for severe policy violations.';
    db.updateUser(id, {
      status: 'banned',
      restrictionReason: banReason,
    });
    matchmaker.closeUserSockets(id, banReason);
  } else if (action === 'restore') {
    db.updateUser(id, {
      status: 'offline',
      restrictionReason: undefined,
      suspendedUntil: undefined,
    });
  }

  const updated = db.getUserById(id);
  res.json({ success: true, user: db.toPublicProfile(updated!) });
});

apiRouter.get('/admin/appeals', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const appeals = db.getAllAppeals();
  res.json({ appeals });
});

apiRouter.post('/admin/appeals/:id/resolve', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const { id } = req.params;
  const { status, adminNote } = req.body;

  const appeal = db.resolveAppeal(id, status, adminNote);
  if (!appeal) {
    res.status(404).json({ error: 'Appeal not found' });
    return;
  }
  res.json({ success: true, appeal });
});

apiRouter.post('/admin/user/:id/volunteer', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const { id } = req.params;
  const { isVolunteer } = req.body;

  const updated = db.updateUser(id, {
    isVolunteer: Boolean(isVolunteer),
    role: Boolean(isVolunteer) ? 'volunteer' : 'user',
  });
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ success: true, user: db.toPublicProfile(updated) });
});

// ----------------------------------------------------
// SUPPORT TICKETS (IN-APP CONTACT ADMIN)
// ----------------------------------------------------
apiRouter.post('/support/ticket', (req: Request, res: Response): void => {
  const { category, subject, message, email } = req.body;

  const validCategories = ['Bug', 'Harassment Report', 'Account Issue', 'Feedback'];
  if (!category || !validCategories.includes(category)) {
    res.status(400).json({ error: 'Please choose a valid ticket category.' });
    return;
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
    res.status(400).json({ error: 'Subject must be at least 3 characters long.' });
    return;
  }

  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    res.status(400).json({ error: 'Message must be at least 10 characters long.' });
    return;
  }

  // Attempt to extract authenticated user if token present
  let userId: string | null = null;
  let userEmail: string | undefined = email && typeof email === 'string' ? email.trim() : undefined;
  let userDisplayName: string | undefined = undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const authUserId = db.getUserIdByToken(token);
    if (authUserId) {
      const user = db.getUserById(authUserId);
      if (user) {
        userId = user.id;
        userEmail = user.email;
        userDisplayName = user.displayName;
      }
    }
  }

  const ticket = db.createSupportTicket({
    userId,
    userEmail,
    userDisplayName,
    category,
    subject: subject.trim(),
    message: message.trim(),
  });

  res.json({
    success: true,
    message: 'Message sent directly to admin review queue.',
    ticketId: ticket.id,
  });
});

apiRouter.get('/admin/tickets', adminLimiter, authenticate, requireStaff, (req: Request, res: Response): void => {
  const tickets = db.getAllSupportTickets();
  res.json({ tickets });
});

apiRouter.post(
  ['/admin/tickets/:id/resolve', '/admin/tickets/:id/status'],
  adminLimiter,
  authenticate,
  requireStaff,
  (req: Request, res: Response): void => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['open', 'resolved', 'dismissed'];
    const newStatus = status || 'resolved';
    if (!validStatuses.includes(newStatus)) {
      res.status(400).json({ error: 'Invalid ticket status.' });
      return;
    }

    const ticket = db.updateSupportTicketStatus(id, newStatus, adminNotes);
    if (!ticket) {
      res.status(404).json({ error: 'Support ticket not found' });
      return;
    }
    res.json({ success: true, ticket });
  }
);

apiRouter.patch(
  '/admin/tickets/:id/status',
  adminLimiter,
  authenticate,
  requireStaff,
  (req: Request, res: Response): void => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['open', 'resolved', 'dismissed'];
    const newStatus = status || 'resolved';
    if (!validStatuses.includes(newStatus)) {
      res.status(400).json({ error: 'Invalid ticket status.' });
      return;
    }

    const ticket = db.updateSupportTicketStatus(id, newStatus, adminNotes);
    if (!ticket) {
      res.status(404).json({ error: 'Support ticket not found' });
      return;
    }
    res.json({ success: true, ticket });
  }
);

// ----------------------------------------------------
// TEST COMPANION / MATCHMAKER SIMULATOR
// ----------------------------------------------------
apiRouter.post('/simulator/match', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const isAdmin = Boolean(user?.role === 'admin' || user?.isAdmin);
  if (process.env.NODE_ENV === 'production' && !isAdmin) {
    res.status(403).json({ error: 'Simulator disabled in production' });
    return;
  }

  const result = matchmaker.createCompanionSession(user.id);
  if (!result.success) {
    res.status(400).json({ error: result.error || 'Failed to start companion session.' });
    return;
  }

  res.json({ success: true, roomId: result.roomId });
});

apiRouter.post('/simulator/action', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const isAdmin = Boolean(user?.role === 'admin' || user?.isAdmin);
  if (process.env.NODE_ENV === 'production' && !isAdmin) {
    res.status(403).json({ error: 'Simulator disabled in production' });
    return;
  }

  const { action, roomId } = req.body;
  if (!roomId || (action !== 'violation' && action !== 'clean_chat')) {
    res.status(400).json({ error: 'Valid roomId and action ("violation" or "clean_chat") are required.' });
    return;
  }

  const result = matchmaker.simulateCompanionAction(user.id, roomId, action);
  if (!result.success) {
    res.status(400).json({ error: result.error || 'Failed to perform simulation action.' });
    return;
  }

  res.json({ success: true });
});

