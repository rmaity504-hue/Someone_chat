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
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuNkr3qBUYhHBQFLXYp5Nksh8U',
  privateKey:
    process.env.VAPID_PRIVATE_KEY ||
    'UUxI4Ovh-mcv0ZsITx-n8v6Z_h_R9i2P0x1e3Q5a7sU',
  subject:
    process.env.VAPID_SUBJECT ||
    'mailto:someone.chat.app@gmail.com',
};

