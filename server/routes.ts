import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { db, hashPassword, verifyPassword } from './db.js';
import { matchmaker } from './matchmaker.js';
import {
  generateVerificationCode,
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendDiagnosticTestEmail,
} from './email.js';
import { REQUIRE_EMAIL_VERIFICATION } from './config.js';

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

  // Check if email verification is bypassed during development
  if (!REQUIRE_EMAIL_VERIFICATION) {
    // Automatically create the user with is_verified = true in PostgreSQL and memory
    const user = db.createUser(cleanEmail, hashPassword(password), displayName.trim(), clientIp, true);
    // Immediately issue an authenticated session token
    const token = db.createSession(user.id);

    res.json({
      ok: true,
      success: true,
      user: db.toPublicProfile(user),
      token,
      bypassedVerification: true,
    });
    return;
  }

  // Create user with scrypt password hash (unverified)
  const user = db.createUser(cleanEmail, hashPassword(password), displayName.trim(), clientIp, false);

  // Generate cryptographically secure 6-digit fallback code and 24-hr verification token
  const code = generateVerificationCode();
  const verificationToken = generateVerificationToken();
  db.setVerificationDetails(user.id, code, verificationToken, 15, 24);

  // Construct one-click verification link
  const baseUrl = getAppBaseUrl(req);
  const verifyLink = `${baseUrl}/verify?token=${verificationToken}`;

  // Dispatch real email via Nodemailer (with prominent Verify button and fallback code)
  let emailResult;
  try {
    emailResult = await sendVerificationEmail(cleanEmail, code, verifyLink);
  } catch (err: any) {
    const errMsg = err?.message || 'SMTP delivery failure';
    console.error(`[REGISTRATION ERROR] Email delivery failed for ${cleanEmail}:`, err?.code ? `[${err.code}]` : '', errMsg);
    // Remove newly created unverified account so user is not stuck
    db.deleteUnverifiedUser(user.id);
    res.status(500).json({
      ok: false,
      error: 'Email delivery failed',
      details: errMsg,
    });
    return;
  }

  // Create server-side session token
  const token = db.createSession(user.id);

  res.json({
    ok: true,
    success: true,
    token,
    user: db.toPublicProfile(user),
    verificationSent: true,
    previewCode: emailResult.previewCode,
    previewLink: emailResult.previewLink,
    bypassedVerification: false,
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

  // Handle email verification requirements
  if (REQUIRE_EMAIL_VERIFICATION) {
    if (!user.isVerified) {
      res.status(403).json({
        error: 'Please verify your email address before logging in.',
        unverified: true,
        email: user.email,
      });
      return;
    }
  } else {
    // If verification is not required, automatically update unverified accounts in PostgreSQL and memory
    if (!user.isVerified) {
      db.markUserVerified(user.id);
    }
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
  if (!REQUIRE_EMAIL_VERIFICATION && !user.isVerified) {
    user = db.markUserVerified(user.id) || user;
  }
  res.json({ user: db.toPublicProfile(user) });
});

apiRouter.post(['/auth/verify-email', '/verify-email'], verificationLimiter, authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Please enter the 6-digit verification code.' });
    return;
  }

  const result = db.verifyEmailCode(user.id, code.trim());
  if (!result.success) {
    res.status(400).json({ error: result.error || 'Verification failed.' });
    return;
  }

  const updated = db.getUserById(user.id);
  res.json({ success: true, user: db.toPublicProfile(updated!) });
});

apiRouter.post('/auth/resend-verification', verificationLimiter, authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  if (user.isVerified) {
    res.json({ success: true, message: 'Your email is already verified.' });
    return;
  }

  const code = generateVerificationCode();
  const verificationToken = generateVerificationToken();
  db.setVerificationDetails(user.id, code, verificationToken, 15, 24);

  const baseUrl = getAppBaseUrl(req);
  const verifyLink = `${baseUrl}/verify?token=${verificationToken}`;
  try {
    const sendResult = await sendVerificationEmail(user.email, code, verifyLink);
    res.json({
      success: true,
      message: 'A new verification link and code have been dispatched to your email.',
      previewCode: sendResult.previewCode,
      previewLink: sendResult.previewLink,
    });
  } catch (err: any) {
    const errMsg = err?.message || 'SMTP delivery failure';
    console.error(`[RESEND ERROR] Email delivery failed for ${user.email}:`, err?.code ? `[${err.code}]` : '', errMsg);
    res.status(500).json({
      error: 'Email delivery failed',
      details: errMsg,
    });
  }
});

apiRouter.get(
  ['/auth/verify-email-link', '/auth/verify-link'],
  async (req: Request, res: Response): Promise<void> => {
    const rawToken = req.query.token;
    if (!rawToken || typeof rawToken !== 'string') {
      res.redirect('/?error=' + encodeURIComponent('Verification link is missing a valid token.'));
      return;
    }

    const result = await db.verifyByToken(rawToken.trim());
    if (!result.success || !result.user) {
      res.redirect('/?error=' + encodeURIComponent(result.error || 'Verification link is invalid or has expired.'));
      return;
    }

    // Issue an authenticated session
    const sessionToken = db.createSession(result.user.id);

    // If programmatic request explicitly accepting JSON
    if (req.accepts('html', 'json') === 'json' && !req.headers['sec-fetch-dest']) {
      res.json({
        success: true,
        message: 'Account verified successfully.',
        token: sessionToken,
        user: db.toPublicProfile(result.user),
      });
      return;
    }

    // Redirect user back to the main app screen as fully authenticated
    res.redirect(`/?auth_token=${encodeURIComponent(sessionToken)}&verified=true`);
  }
);

apiRouter.post(
  ['/auth/forgot-password', '/forgot-password'],
  forgotPasswordLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.getUserByEmail(cleanEmail);

    // Constant-time protection against user enumeration:
    // If user does not exist or is banned, return generic success without leaking status
    if (!user || user.status === 'banned') {
      res.json({
        success: true,
        message: 'If an account exists with that email address, a 6-digit password reset code has been dispatched.',
      });
      return;
    }

    const code = generateVerificationCode();
    await db.createPasswordReset(user.id, code, 15);
    const emailResult = await sendPasswordResetEmail(user.email, code);

    res.json({
      success: true,
      message: 'If an account exists with that email address, a 6-digit password reset code has been dispatched.',
      previewCode: emailResult.previewCode,
      isSandboxRestriction: emailResult.isSandboxRestriction,
      emailWarning: emailResult.isSandboxRestriction
        ? `Resend sandbox delivers to rmaity504@gmail.com. For testing ${cleanEmail}, your reset code is ${emailResult.previewCode}.`
        : undefined,
    });
  }
);

apiRouter.post(
  ['/auth/reset-password', '/reset-password'],
  resetPasswordLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { email, code, newPassword } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Please provide your account email address.' });
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Please enter the 6-digit reset code.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters in length.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.getUserByEmail(cleanEmail);
    if (!user || user.status === 'banned') {
      res.status(400).json({ error: 'Invalid or expired password reset request.' });
      return;
    }

    const verifyResult = await db.verifyAndConsumePasswordReset(user.id, code);
    if (!verifyResult.success) {
      res.status(400).json({ error: verifyResult.error || 'Invalid or expired reset code.' });
      return;
    }

    // Hash new password, update user, and invalidate all existing active sessions
    await db.updateUserPassword(user.id, newPassword);

    res.json({
      success: true,
      message: 'Your password has been successfully reset. All previous sessions have been signed out. Please sign in with your new password.',
    });
  }
);

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
// FRIENDS (MUTUAL CONSENT ONLY)
// ----------------------------------------------------

apiRouter.get('/friends', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const friends = db.getFriendshipsForUser(user.id);
  res.json({ friends });
});

apiRouter.post('/friends/remove', authenticate, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { friendId } = req.body;
  if (!friendId) {
    res.status(400).json({ error: 'Friend ID is required.' });
    return;
  }
  db.removeFriendship(user.id, friendId);
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

