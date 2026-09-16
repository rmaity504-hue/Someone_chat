/**
 * Privacy Shield & Data Filter for Someone.
 * Provides client-side sanitization, strict 500-character ceiling, zero-width stripping,
 * and optional PII & contact exchange detection (phone numbers, raw links, social handles).
 */

export interface FilterResult {
  allowed: boolean;
  sanitizedText: string;
  hasContactOrLink?: boolean;
  detectedTypes?: ('phone' | 'link' | 'handle')[];
  reason?: string;
}

export interface ContactDetectionResult {
  hasContactOrLink: boolean;
  types: ('phone' | 'link' | 'handle')[];
  description?: string;
}

// Regex matching zero-width spaces, joiners, non-joiners, word joiners, byte-order marks and direction overrides
// \u200B (ZWSP), \u200C (ZWNJ), \u200D (ZWJ), \uFEFF (BOM), \u200E (LRM), \u200F (RLM), \u202A-\u202E (Bidi), \u2060 (WJ)
export const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060\u00AD]/g;

export const MAX_MESSAGE_LENGTH = 500;

/**
 * Strips zero-width characters and invisible padding from text.
 */
export function stripZeroWidthCharacters(text: string): string {
  if (!text) return '';
  return text.replace(ZERO_WIDTH_REGEX, '');
}

/**
 * Sanitizes chat payload: removes invisible zero-width characters, trims whitespace,
 * and enforces strict 500-character ceiling.
 */
export function sanitizeChatMessage(rawText: string): string {
  const cleanZeroWidth = stripZeroWidthCharacters(rawText || '');
  const trimmed = cleanZeroWidth.trim();
  if (!trimmed) return '';
  return trimmed.length > MAX_MESSAGE_LENGTH
    ? trimmed.slice(0, MAX_MESSAGE_LENGTH).trim()
    : trimmed;
}

// Regex matching raw links: http://, https://, ftp://, t.me/, wa.me/, www., or recognized top-level domain URLs
const URL_PATTERN = /(?:https?:\/\/|ftps?:\/\/|www\.|t\.me\/|wa\.me\/)[^\s/$.?#].[^\s]*|\b[a-zA-Z0-9-]+\.(?:com|org|net|io|co|app|me|dev|xyz|info|edu|gov|site|online|link|ai|tv|gg|club|cc|ly|to|be)\b(?:\/[^\s]*)?/i;

// Regex matching phone numbers: sequences of digits with delimiters (+, -, ., (), spaces)
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{3,5}\b|\b(?:\+?\d[\s().-]*){10,}\d\b/g;

// Regex matching social handles: @username, ig: handle, snap: handle, discord: handle, tg: handle, etc.
const SOCIAL_HANDLE_PATTERN = /(?:^|\s)@[a-zA-Z0-9_.]{3,30}\b|(?:\b(?:ig|insta|instagram|snap|snapchat|discord|tg|telegram|twitter|tiktok|wa|whatsapp|kik)\s*[:=]\s*@?[a-zA-Z0-9_.-]{3,}\b)/i;

/**
 * Detects phone numbers, raw links (http/https/t.me), and social handles (@username)
 * in typed chat messages for the optional privacy and safety layer.
 */
export function detectContactOrLinks(rawText: string): ContactDetectionResult {
  if (!rawText) return { hasContactOrLink: false, types: [] };
  const text = stripZeroWidthCharacters(rawText);
  const types: ('phone' | 'link' | 'handle')[] = [];

  // 1. Raw links
  if (URL_PATTERN.test(text)) {
    types.push('link');
  }

  // 2. Phone numbers (ensure at least 7-10 total digits to avoid matching plain single numbers or times)
  const phoneMatches = text.match(PHONE_PATTERN);
  if (phoneMatches) {
    const hasValidPhone = phoneMatches.some((m) => {
      const digitCount = (m.match(/\d/g) || []).length;
      return digitCount >= 7;
    });
    if (hasValidPhone) {
      types.push('phone');
    }
  }

  // 3. Social handles (@username, ig:, snap:, etc.)
  if (SOCIAL_HANDLE_PATTERN.test(text)) {
    types.push('handle');
  }

  return {
    hasContactOrLink: types.length > 0,
    types,
    description: types.length > 0
      ? 'For your safety and anonymity, sharing personal contacts or links is discouraged.'
      : undefined,
  };
}

/**
 * Filter and sanitize chat messages before transmission over WebSocket.
 * - Strips zero-width and invisible unicode characters.
 * - Enforces strict 500-character maximum length limit.
 * - Inspects for external links, phone numbers, and handles.
 */
export function filterChatMessage(
  rawText: string,
  options?: { allowContactsAndLinks?: boolean }
): FilterResult {
  const sanitizedText = sanitizeChatMessage(rawText);
  if (!sanitizedText) {
    return { allowed: false, sanitizedText: '' };
  }

  const detection = detectContactOrLinks(sanitizedText);

  // If contacts/links are allowed by user choice
  if (options?.allowContactsAndLinks) {
    return {
      allowed: true,
      sanitizedText,
      hasContactOrLink: detection.hasContactOrLink,
      detectedTypes: detection.types,
    };
  }

  return {
    allowed: true,
    sanitizedText,
    hasContactOrLink: detection.hasContactOrLink,
    detectedTypes: detection.types,
    reason: detection.hasContactOrLink ? detection.description : undefined,
  };
}

