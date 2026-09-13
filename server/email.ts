import 'dotenv/config';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

type Transporter = ReturnType<typeof nodemailer.createTransport>;

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isSandboxRestriction?: boolean;
  previewCode?: string;
  previewLink?: string;
}

let transporter: Transporter | null = null;

function isSmtpHostDisabled(host?: string): boolean {
  if (!host) return true;
  const normalized = host.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === 'disabled' ||
    normalized === 'none' ||
    normalized === 'off' ||
    normalized === 'false' ||
    normalized === 'null' ||
    normalized === 'undefined'
  );
}

export function getEmailTransporter(): Transporter | null {
  if (!transporter) {
    const rawHost = process.env.SMTP_HOST;
    if (isSmtpHostDisabled(rawHost) && !process.env.RESEND_API_KEY) {
      return null;
    }

    const host = !isSmtpHostDisabled(rawHost)
      ? rawHost!.trim()
      : process.env.RESEND_API_KEY
      ? 'smtp.resend.com'
      : undefined;
    if (!host) return null;

    const isResend = host.includes('resend.com') || Boolean(process.env.RESEND_API_KEY);
    const port = parseInt(process.env.SMTP_PORT || (isResend ? '465' : '587'), 10);
    const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;
    const user = process.env.SMTP_USER || (isResend ? 'resend' : undefined);
    const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return transporter;
}

function getDefaultFromAddress(): string {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const rawHost = process.env.SMTP_HOST;
  const isResend =
    (!isSmtpHostDisabled(rawHost) && rawHost?.includes('resend.com')) || Boolean(process.env.RESEND_API_KEY);
  return isResend ? '"Someone" <onboarding@resend.dev>' : '"Someone" <noreply@someone.chat>';
}

/**
 * Startup self-check using Nodemailer's built-in transporter.verify()
 */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string; code?: string }> {
  const rawHost = process.env.SMTP_HOST;
  if (isSmtpHostDisabled(rawHost) && !process.env.RESEND_API_KEY) {
    console.log('[SMTP] SMTP is disabled or not configured. Running with local development email fallback.');
    return { ok: false, error: 'SMTP disabled or not configured', code: 'ENOCONFIG' };
  }

  const mailer = getEmailTransporter();
  if (!mailer) {
    console.log('[SMTP] No active SMTP transporter configured. Running with local development email fallback.');
    return { ok: false, error: 'SMTP_HOST not configured', code: 'ENOCONFIG' };
  }

  try {
    await mailer.verify();
    console.log('[SMTP] Connection and credentials verified successfully.');
    return { ok: true };
  } catch (err: any) {
    const errCode = err?.code ? `[${err.code}]` : '[UNKNOWN]';
    const errMsg = err?.message || String(err);
    console.warn(`[SMTP NOTICE] Verification check: ${errCode} ${errMsg}. Using email preview mode.`);
    return { ok: false, error: errMsg, code: err?.code };
  }
}

/**
 * Diagnostic test email sender for verifying SMTP transport end-to-end
 */
export async function sendDiagnosticTestEmail(toEmail: string): Promise<{
  ok: boolean;
  messageId?: string;
  response?: string;
  error?: string;
  code?: string;
  command?: string;
}> {
  const mailer = getEmailTransporter();
  if (!mailer) {
    const msg = 'SMTP transporter is not configured. Missing SMTP_HOST environment variable.';
    console.error(`[SMTP ERROR] Diagnostic test failed: ${msg}`);
    return {
      ok: false,
      error: msg,
      code: 'ENOCONFIG',
    };
  }

  const fromAddress = getDefaultFromAddress();
  try {
    console.log(`[SMTP DIAGNOSTIC] Attempting test email to ${toEmail} from ${fromAddress}`);
    const info = await mailer.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Someone SMTP Diagnostic Test',
      text: `This is a diagnostic verification email from Someone sent at ${new Date().toISOString()}.\nIf you received this email, your SMTP configuration is operating properly.`,
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1c1917; background-color: #faf9f6; border-radius: 12px; border: 1px solid #e7e5e4;">
        <h2 style="margin-top: 0; color: #1c1917;">Someone SMTP Diagnostic Test</h2>
        <p>This is a verification test email dispatched from <strong>Someone</strong> at ${new Date().toISOString()}.</p>
        <p style="color: #15803d; font-weight: 600;">✔ SMTP connection and credentials are valid and delivering messages.</p>
      </div>`,
    });

    console.log(`[SMTP DIAGNOSTIC] Test email dispatched successfully! Message ID: ${info.messageId}`);
    return {
      ok: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (err: any) {
    console.error(`[SMTP ERROR] Diagnostic test failed for recipient ${toEmail}:`, err?.code || '', err?.message || err);
    return {
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
      command: err?.command,
    };
  }
}

/**
 * Generate a cryptographically secure 6-digit verification code.
 */
export function generateVerificationCode(): string {
  // Uses crypto.randomInt for uniform integer distribution
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Generate a cryptographically secure, random 24-hour verification token.
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Dispatch verification email to user with one-click verification button and fallback code.
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  verifyLink: string
): Promise<EmailSendResult> {
  const mailer = getEmailTransporter();
  const subject = 'Verify your email for Someone';

  const textContent = `Welcome to Someone.

Click the link below to verify your email address and activate your account:
${verifyLink}

Alternatively, you can enter this 6-digit verification code in the app:
${code}

(The one-click link is valid for 24 hours. The 6-digit code expires in 15 minutes.)

If you did not create an account on Someone, please ignore this email.`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #faf9f6; margin: 0; padding: 36px 16px; color: #292524; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.03); }
    .brand { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; color: #1c1917; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #1c1917; margin: 0 0 14px 0; line-height: 1.3; }
    p { font-size: 14px; line-height: 1.6; color: #57534e; margin: 0 0 20px 0; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #1c1917; color: #fafaf9 !important; font-size: 15px; font-weight: 500; text-decoration: none; padding: 13px 32px; border-radius: 12px; letter-spacing: 0.01em; }
    .link-text { font-size: 12px; color: #78716c; word-break: break-all; margin-top: 12px; }
    .fallback-box { margin-top: 28px; padding-top: 24px; border-top: 1px dashed #e7e5e4; }
    .code-badge { background-color: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px 20px; font-size: 24px; font-family: monospace; letter-spacing: 6px; font-weight: bold; color: #1c1917; text-align: center; margin: 12px 0; }
    .footer { margin-top: 32px; padding-top: 18px; border-top: 1px solid #f5f5f4; font-size: 12px; color: #a8a29e; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Someone</div>
    <h1>Verify your email address</h1>
    <p>Welcome to Someone. To activate your account and start genuine 1-on-1 conversations, click the button below to verify your email instantly:</p>
    <div class="btn-wrap">
      <a href="${verifyLink}" class="btn" target="_blank">Verify Email</a>
    </div>
    <p class="link-text">If the button doesn't open, copy and paste this link into your browser:<br><a href="${verifyLink}" style="color: #44403c;">${verifyLink}</a></p>
    <div class="fallback-box">
      <p style="font-size: 13px; color: #78716c; margin-bottom: 6px;">Prefer using a code? Enter this 6-digit code in the app:</p>
      <div class="code-badge">${code}</div>
      <p style="font-size: 12px; color: #a8a29e; margin: 0;">This 6-digit code expires in 15 minutes. The one-click button is valid for 24 hours.</p>
    </div>
    <div class="footer">
      If you did not sign up for an account on Someone, you can safely disregard this message.
    </div>
  </div>
</body>
</html>`;

  if (mailer) {
    try {
      const fromAddress = getDefaultFromAddress();
      const info = await mailer.sendMail({
        from: fromAddress,
        to: email,
        subject,
        text: textContent,
        html: htmlContent,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EMAIL DISPATCH] Verification email sent to ${email}. Preview: ${previewUrl}`);
      } else {
        console.log(`[EMAIL DISPATCH] Verification email sent to ${email} (Message ID: ${info.messageId})`);
      }
      return { success: true, messageId: info.messageId, previewLink: verifyLink };
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      console.error('[EMAIL ERROR] Failed to send verification email via SMTP:', err?.code ? `[${err.code}]` : '', errMsg);
      throw err;
    }
  }

  // Fallback for local development when SMTP is not configured
  if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production') {
    console.log(`\n========================================\n[DEV SMTP EMULATION]\nTo: ${email}\nVerify Link: ${verifyLink}\nVerification Code: ${code}\n(Link valid for 24h, code for 15 min)\n========================================\n`);
    return { success: true, previewCode: code, previewLink: verifyLink };
  } else {
    console.warn(`[WARN] SMTP not configured. Unable to send verification email to ${email}`);
    throw new Error('SMTP mail service is not configured on this server (Missing SMTP_HOST).');
  }
}

/**
 * Note: Password recovery uses secret security question & answer verification directly.
 * Legacy email stub kept for backward interface compatibility only.
 */
export async function sendPasswordResetEmail(email: string, _code?: string): Promise<EmailSendResult> {
  console.log(`[PASSWORD RECOVERY] Recovery requested for ${email} via secret security question flow.`);
  return { success: true };
}
