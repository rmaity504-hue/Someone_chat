/**
 * In-memory client-side keyword detector for acute distress or self-harm.
 * Zero-logging: matches are never transmitted, persisted, or associated with user IDs or logs.
 */

// Sensitive regex pattern for self-harm or acute distress
export const CRISIS_PATTERN = /(suicid|end my life|kill myself|want to die|self harm|hurt myself)/i;

/**
 * Checks if text contains self-harm or acute crisis phrases in client memory.
 */
export function checkCrisisKeywords(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return CRISIS_PATTERN.test(text);
}
