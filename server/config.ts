import 'dotenv/config';

/**
 * Environment-based configuration flags
 * Email verification is permanently disabled across the application.
 */
export const REQUIRE_EMAIL_VERIFICATION = false;

// Standard 65-byte uncompressed P-256 Web Push VAPID credentials
export const VAPID_CONFIG = {
  publicKey:
    process.env.VAPID_PUBLIC_KEY ||
    'BMzvZylzxhzL7LmFSW7Swj7GGariKK7WAWbk-Q2ESt1apjR2Ek9Rb1tfLSwoli3ww4IUfIlR1-VWATH1tAFJCBw',
  privateKey:
    process.env.VAPID_PRIVATE_KEY ||
    'tZ9kly49ai8KYQQU_11mVSk6VLjzUSHK-xH6vgncKak',
  subject:
    process.env.VAPID_SUBJECT ||
    'mailto:someone.chat.app@gmail.com',
};

