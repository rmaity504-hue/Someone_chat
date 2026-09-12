import 'dotenv/config';

/**
 * Environment-based configuration flags
 * Default REQUIRE_EMAIL_VERIFICATION to false unless explicitly set to 'true'.
 */
export const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
