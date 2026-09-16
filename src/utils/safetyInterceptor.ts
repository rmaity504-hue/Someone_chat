/**
 * In-memory client-side keyword detector for acute distress or self-harm.
 * Zero-logging: matches are never transmitted, persisted, or associated with user IDs or logs.
 * Evaluates purely in local browser memory.
 */

// Sensitive regex pattern for self-harm or acute distress
export const CRISIS_PATTERN =
  /(suicid|end my life|kill myself|want to die|self harm|hurt myself|don't want to live|cutting myself)/i;

/**
 * Pure function: Checks if text expresses self-harm or acute crisis intent in client memory.
 * Returns true if crisis keywords or intent are detected; false otherwise.
 * Never logs, tags, or stores the result on any server or telemetry.
 */
export function detectCrisisIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return CRISIS_PATTERN.test(text);
}

/**
 * Backwards compatibility alias for detectCrisisIntent.
 */
export const checkCrisisKeywords = detectCrisisIntent;

