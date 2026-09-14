/**
 * Privacy Shield & Data Filter for Someone.
 * Ensures the chat sanctuary remains free of external links and redacts sensitive phone numbers.
 */

export interface FilterResult {
  allowed: boolean;
  sanitizedText: string;
  reason?: string;
}

// Regex matching URLs: explicit schemes (http, https, ftp), www prefixes, and common web domains
const URL_PATTERN = /(?:https?:\/\/|ftps?:\/\/|www\.)[^\s/$.?#].[^\s]*|\b[a-zA-Z0-9-]+\.(?:com|org|net|io|co|app|me|dev|xyz|info|edu|gov|site|online|link|ai|tv|gg|club)\b(?:\/[^\s]*)?/i;

// Regex matching 10+ digit sequences with standard delimiters (+, -, ., (), spaces)
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{3,5}\b|\b(?:\+?\d[\s().-]*){10,}\d\b/g;

/**
 * Filter and sanitize chat messages before transmission over WebSocket.
 * - Disallows external URLs/links and provides a peaceful notice.
 * - Automatically redacts 10+ digit phone numbers with "[redacted]".
 */
export function filterChatMessage(rawText: string): FilterResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { allowed: false, sanitizedText: '' };
  }

  // 1. Check for external URLs / links
  if (URL_PATTERN.test(trimmed)) {
    return {
      allowed: false,
      sanitizedText: trimmed,
      reason: 'Links are kept out to maintain a quiet sanctuary.',
    };
  }

  // 2. Redact phone numbers (10+ digits)
  const sanitizedText = trimmed.replace(PHONE_PATTERN, (match) => {
    const digitCount = (match.match(/\d/g) || []).length;
    return digitCount >= 10 ? '[redacted]' : match;
  });

  return {
    allowed: true,
    sanitizedText,
  };
}
