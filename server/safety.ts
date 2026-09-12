import { ModerationFlagRecord } from '../src/types.js';

export interface SafetyEvaluation {
  isViolating: boolean;
  isSeriousSexualViolation: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'severe';
  category?: string;
  reason?: string;
  confidence: 'none' | 'low' | 'medium' | 'high';
  isSeverePredatory: boolean;
  isLegitimateContext: boolean;
  penaltySuggestion?: 'warning' | '30_day_suspension' | '90_day_suspension' | 'permanent_ban';
}

// ----------------------------------------------------
// 1. Legitimate Sensitive Context Indicators
// These protect medical, health, trauma, relationship,
// abuse, consent, and educational discussions from false-positive flags.
// ----------------------------------------------------
const MEDICAL_HEALTH_REGEX =
  /\b(doctor|physician|nurse|surgeon|hospital|clinic|urologist|gynecologist|obstetrician|dermatologist|pediatrician|oncologist|therapist|psychologist|psychiatrist|counselor|prescription|prescribed|medicine|medication|exam|examination|examined|examine|surgery|diagnosed|diagnosis|biopsy|ultrasound|mammogram|pap\s*smear|infection|std|sti|hiv|hpv|cancer|pain|hurts|hurt|swollen|swelling|rash|symptom|symptoms|procedure|treatment|test|tested|medical|health|prostate|anatomy|biology|body|disease|uterus|cervix|testicle|testicular|menstruation|period|vasectomy|physical\s+therapy)\b/i;

const TRAUMA_SURVIVOR_REGEX =
  /\b(assault|assaulted|rape|raped|abused|abuse|survivor|survived|surviving|molested|molestation|coerced|coercion|trauma|ptsd|violated|violation|non-consensual|harassed\s+at|harassed\s+by|reported\s+to|police|counselor|crisis\s+line|crisis\s+hotline|healing|support\s+group|victim|domestic\s+violence|toxic\s+relationship|forced\s+me|flashbacks?)\b/i;

const RELATIONSHIP_EMOTIONAL_REGEX =
  /\b(my\s+(husband|wife|boyfriend|girlfriend|partner|spouse|ex)|our\s+marriage|intimacy|relationship|counseling|we\s+broke\s+up|divorce|divorced|marital|asexual|aromantic|orientation|coming\s+out|celibate|celibacy|dating|breakup|libido|emotional\s+distance)\b/i;

const CONSENT_EDUCATIONAL_REGEX =
  /\b(consent|consenting|consensual|safe\s+sex|condom|birth\s+control|contraception|boundaries|communicated\s+boundaries|class|course|university|college|study|studied|biology|anatomy|education|sexuality|scientific|academic|research|paper|sex\s*ed)\b/i;

// Explicit emotional vulnerability phrases that MUST NEVER be flagged
const HUMAN_VULNERABILITY_PHRASES = [
  'lonely',
  'sad',
  'shy',
  'awkward',
  'quiet',
  'crying',
  'depressed',
  'hurting',
  'miss someone',
  'hard day',
  'nobody to talk to',
  'feeling down',
  'just need a friend',
  'anxious',
  'scared',
  'lost',
  'overwhelmed',
  'heartbreak',
  'grieving',
];

// ----------------------------------------------------
// 2. Prohibited Sexual Behaviour Patterns
// High-confidence behavioural patterns directed at
// another person or soliciting sexual encounters/content.
// ----------------------------------------------------

// Explicit requests for nude or sexual images/photos
const NUDE_PHOTO_REQUEST_REGEX =
  /\b(can\s+you|could\s+you|will\s+you|wanna|want\s+to|please|u\s+gotta)?\s*(send|show|give|snap|share|trade|dm|drop)\s+(me\s+)?(a\s+)?(pic|pics|picture|pictures|photo|photos|snap|snaps|vid|video|videos)\s+of\s+(your|ur|dem|them)\s+(tits|boobs|breast|breasts|dick|cock|penis|pussy|vagina|ass|clit|crotch|body|nudes?)\b/i;

const DIRECT_NUDE_SOLICIT_REGEX =
  /\b(send\s+(me\s+)?(nudes?|tits?|boobs?|dick|cock|pussy|crotch\s*shot)|snap\s*nudes?|wanna\s+trade\s+(nudes?|pics?)|trade\s+(nudes?|pics?)|got\s+nudes\??|do\s+you\s+have\s+nudes\??|let\s+me\s+see\s+(your|ur)\s+(tits|boobs|dick|cock|pussy|vagina|ass|nudes?)|show\s+(me\s+)?(your|ur)\s+(tits|boobs|dick|cock|pussy|vagina|ass|clit|nudes?))\b/i;

// Explicit propositions & cybersex requests directed at the user
const CYBERSEX_PROPOSITION_REGEX =
  /\b((wanna|want\s+to|do\s+you\s+wanna|wanna\s+have|let'?s\s+have|let'?s)\s+(sext|cyber|cybersex|talk\s+dirty|cam)\b|sext\s+(me|us|now|with\s+me)|wanna\s+fuck\??|do\s+you\s+wanna\s+fuck\??)\b/i;

const DIRECT_SEXUAL_COMMAND_REGEX =
  /\b(are\s+you\s+(horny|wet|hard)\??|get\s+naked|take\s+off\s+your\s+clothes|touch\s+your\s+(pussy|dick|tits|clit)|jerk\s+off\s+(for|to|with)\s+me|suck\s+my\s+(dick|cock)|fuck\s+me\b|show\s+me\s+how\s+you\s+(masturbate|touch\s+yourself))\b/i;

// Sexual harassment / sexual remarks directed at the partner's body
const DIRECT_SEXUAL_HARASSMENT_REGEX =
  /\b(you\s+have|ur|you're)\s+(got\s+)?(sexy|nice|hot|huge|tight|big)\s+(tits|boobs|ass|pussy|cock|dick)\b/i;

const DIRECT_SEXUAL_INTENT_REGEX =
  /\bi\s+want\s+to\s+(fuck|penetrate|eat\s+out|lick|suck)\s+(you|your\s+(pussy|tits|ass|cock|dick|vagina))\b/i;

// Commercial sexual solicitation / off-platform sex promotion
const COMMERCIAL_SEXUAL_SOLICITATION_REGEX =
  /\b(onlyfans\.com|my\s+onlyfans|selling\s+(nudes?|content|pics?)|buy\s+my\s+(nudes?|content|pics?|vids?)|paypig|findom|cashapp\s+for\s+nudes?|cam\s*girl)\b/i;

// Severe predatory / grooming behaviour targeting minors
const PREDATORY_BEHAVIOUR_REGEX =
  /\b(how\s+young\s+are\s+you|are\s+you\s+under\s*18|schoolgirl|little\s+girl|little\s+boy|any\s+kids\s+here)\b/i;

// Coercive sexual behaviour & blackmail
const COERCIVE_SEXUAL_REGEX =
  /\b(send\s+(nudes?|pics?)\s+or\s+(else|i('ll)?\s+leak|i('ll)?\s+expose)|leak\s+your\s+(nudes?|photos?|pics?)|do\s+as\s+i\s+say\s+or\s+i('ll)?\s+leak)\b/i;

// Extreme non-sexual threats & violent harassment
const VIOLENT_THREAT_REGEX =
  /\b(kill\s+(yourself|urself)|i('ll|\s*will)\s+(murder|kill|hunt|dox|stalk)\s+you|kys|hope\s+you\s+die)\b/i;

/**
 * Advanced text normalization for moderation evasion detection:
 * 1. Unicode NFKC normalization (converts fullwidth, styled fonts, compatibility symbols).
 * 2. Strips zero-width characters, invisible joiners, and formatting marks.
 * 3. Cyrillic and foreign homoglyph conversion (e.g. 'а', 'е', 'о', 'р', 'с', 'х', 'у' -> latin).
 * 4. Leetspeak substitutions (@, 4 -> a; 3 -> e; 1, !, | -> i; 0 -> o; $, 5 -> s; 7, + -> t; etc.)
 * 5. Spaced/separated character sequence joining (e.g. "s e n d   n u d e s" -> "send nudes", "s.e.x.t" -> "sext").
 * 6. Repeated character squashing (e.g. "nuuuudes" -> "nudes", "seeeext" -> "sext").
 */
export function normalizeTextForModeration(input: string): string {
  // 1. Unicode NFKC normalization
  let normalized = input.normalize('NFKC').toLowerCase();

  // 2. Strip zero-width, formatting, and invisible characters
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E\u2000-\u200F\u2028-\u202F\u205F\u00A0\u1680\u3000\u2061-\u2064\uFE00-\uFE0F]/g, '');

  // 3. Convert common Cyrillic / Greek homoglyphs used in evasion
  const homoglyphs: Record<string, string> = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
    'і': 'i', 'ї': 'i', 'ѕ': 's', 'ј': 'j', 'в': 'b', 'к': 'k', 'м': 'm', 'т': 't',
  };
  normalized = normalized.replace(/[аеорсхуіїѕјвкмт]/g, (ch) => homoglyphs[ch] || ch);

  // 4. Safe character substitutions (leetspeak evasion)
  normalized = normalized
    .replace(/(?<=[a-z0-9])@(?![\w.-]+\.[a-z]{2,})/g, 'a')
    .replace(/(?<!\S)@(?=[a-z])/g, 'a')
    .replace(/[$5](?=[a-z])/g, 's')
    .replace(/(?<=[a-z])[$5]/g, 's')
    .replace(/(?<=[a-z])0(?=[a-z])/g, 'o')
    .replace(/(?<=[a-z])3(?=[a-z])/g, 'e')
    .replace(/(?<=[a-z])[1!|](?=[a-z])/g, 'i')
    .replace(/(?<=[a-z])[7+](?=[a-z])/g, 't')
    .replace(/(?<=[a-z])4(?=[a-z])/g, 'a');

  // 5. Join spaced or punctuated single-character sequences (e.g. "s e n d", "n.u.d.e.s", "s_e_x_t", "c-o-c-k")
  // Matches 3 or more single letters separated by space or separator
  normalized = normalized.replace(/\b([a-z])(?:[\s\.\-_*~]+([a-z])){2,}\b/g, (match) => {
    return match.replace(/[\s\.\-_*~]/g, '');
  });

  // 6. Squash repeated letters (3 or more) down to 1 or 2 (e.g. "nuuuuudes" -> "nudes", "seeeeext" -> "sext")
  normalized = normalized.replace(/([a-z])\1{2,}/g, '$1');

  // 7. Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Evaluates whether a message is a legitimate sensitive discussion
 * or a prohibited behavioural violation.
 */
export function evaluateMessageSafety(text: string, messageIndexInSession: number = 0): SafetyEvaluation {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      isViolating: false,
      isSeriousSexualViolation: false,
      severity: 'none',
      confidence: 'none',
      isSeverePredatory: false,
      isLegitimateContext: false,
    };
  }

  // Normalized version to catch simple and sophisticated evasion techniques
  const normalized = normalizeTextForModeration(trimmed);

  // 1. Check Severe Predatory Behaviour (Grooming / Inappropriate Age Inquiries targeting minors)
  // NEVER legitimate regardless of context
  if (PREDATORY_BEHAVIOUR_REGEX.test(trimmed) || PREDATORY_BEHAVIOUR_REGEX.test(normalized)) {
    return {
      isViolating: true,
      isSeriousSexualViolation: true,
      severity: 'severe',
      category: 'predatory_behaviour',
      reason: 'Grooming or suspected predatory behaviour targeting minors.',
      confidence: 'high',
      isSeverePredatory: true,
      isLegitimateContext: false,
      penaltySuggestion: 'permanent_ban',
    };
  }

  // 2. Check Coercive Sexual Behaviour / Blackmail / Extortion
  // NEVER legitimate regardless of context
  if (COERCIVE_SEXUAL_REGEX.test(trimmed) || COERCIVE_SEXUAL_REGEX.test(normalized)) {
    return {
      isViolating: true,
      isSeriousSexualViolation: true,
      severity: 'severe',
      category: 'coercion',
      reason: 'Coercive sexual behaviour or extortion/blackmail.',
      confidence: 'high',
      isSeverePredatory: true,
      isLegitimateContext: false,
      penaltySuggestion: 'permanent_ban',
    };
  }

  // 3. Check Violent Threats / Extreme Harassment
  if (VIOLENT_THREAT_REGEX.test(trimmed) || VIOLENT_THREAT_REGEX.test(normalized)) {
    return {
      isViolating: true,
      isSeriousSexualViolation: false,
      severity: 'high',
      category: 'threats',
      reason: 'Violent threat or severe harassment.',
      confidence: 'high',
      isSeverePredatory: false,
      isLegitimateContext: false,
      penaltySuggestion: '30_day_suspension',
    };
  }

  // 4. Detect Legitimate Sensitive Context (Health, Medical, Trauma, Relationship, Consent, Education)
  const isMedical = MEDICAL_HEALTH_REGEX.test(trimmed) || MEDICAL_HEALTH_REGEX.test(normalized);
  const isTrauma = TRAUMA_SURVIVOR_REGEX.test(trimmed) || TRAUMA_SURVIVOR_REGEX.test(normalized);
  const isRelationship = RELATIONSHIP_EMOTIONAL_REGEX.test(trimmed) || RELATIONSHIP_EMOTIONAL_REGEX.test(normalized);
  const isConsentOrEdu = CONSENT_EDUCATIONAL_REGEX.test(trimmed) || CONSENT_EDUCATIONAL_REGEX.test(normalized);
  const isLegitimateContext = isMedical || isTrauma || isRelationship || isConsentOrEdu;

  // 5. Evaluate Direct Sexual Behaviour Violations
  const isNudeRequest =
    NUDE_PHOTO_REQUEST_REGEX.test(trimmed) ||
    DIRECT_NUDE_SOLICIT_REGEX.test(trimmed) ||
    NUDE_PHOTO_REQUEST_REGEX.test(normalized) ||
    DIRECT_NUDE_SOLICIT_REGEX.test(normalized);

  const isCyberProposition =
    CYBERSEX_PROPOSITION_REGEX.test(trimmed) || CYBERSEX_PROPOSITION_REGEX.test(normalized);

  const isSexualCommand =
    DIRECT_SEXUAL_COMMAND_REGEX.test(trimmed) || DIRECT_SEXUAL_COMMAND_REGEX.test(normalized);

  const isSexualHarassment =
    DIRECT_SEXUAL_HARASSMENT_REGEX.test(trimmed) ||
    DIRECT_SEXUAL_INTENT_REGEX.test(trimmed) ||
    DIRECT_SEXUAL_HARASSMENT_REGEX.test(normalized) ||
    DIRECT_SEXUAL_INTENT_REGEX.test(normalized);

  const isCommercialSolicit =
    COMMERCIAL_SEXUAL_SOLICITATION_REGEX.test(trimmed) ||
    COMMERCIAL_SEXUAL_SOLICITATION_REGEX.test(normalized);

  // 6. Sensitive Context Protection Check:
  // If legitimate context is present (medical examination, sexual health, relationship dynamics,
  // assault/trauma survivor testimony, or consent discussion):
  // We strictly distinguish between legitimate discussions versus actual unsolicited propositions directed at the partner.
  if (isLegitimateContext) {
    // Only direct solicitation of the chat partner (such as asking for nude pictures, cybersex, or selling)
    // overrides legitimate context protection.
    const isDirectSolicitationOfPartner = isNudeRequest || isCyberProposition || isCommercialSolicit;

    if (!isDirectSolicitationOfPartner) {
      // The message describes trauma, medical symptoms, relationship concerns, or consent education.
      // Explicitly protect from false-positive flags or suspensions!
      return {
        isViolating: false,
        isSeriousSexualViolation: false,
        severity: 'none',
        confidence: 'none',
        isSeverePredatory: false,
        isLegitimateContext: true,
      };
    }
  }

  // 7. Enforcement of Direct Sexual Solicitation & Harassment
  if (isNudeRequest) {
    return {
      isViolating: true,
      isSeriousSexualViolation: true,
      severity: 'high',
      category: 'sexual_solicitation',
      reason: 'Request for nude or sexual photographs directed at another user.',
      confidence: 'high',
      isSeverePredatory: false,
      isLegitimateContext: false,
      penaltySuggestion: '30_day_suspension',
    };
  }

  if (isCyberProposition) {
    return {
      isViolating: true,
      isSeriousSexualViolation: true,
      severity: 'high',
      category: 'sexual_solicitation',
      reason: 'Unsolicited sexual proposition or request for sex chatting.',
      confidence: 'high',
      isSeverePredatory: false,
      isLegitimateContext: false,
      penaltySuggestion: '30_day_suspension',
    };
  }

  if (isSexualCommand || isSexualHarassment) {
    return {
      isViolating: true,
      isSeriousSexualViolation: true,
      severity: 'high',
      category: 'unwanted_sexual_content',
      reason: 'Explicit sexual comments or demands directed at another person.',
      confidence: 'high',
      isSeverePredatory: false,
      isLegitimateContext: false,
      penaltySuggestion: '30_day_suspension',
    };
  }

  if (isCommercialSolicit) {
    return {
      isViolating: true,
      isSeriousSexualViolation: true,
      severity: 'high',
      category: 'sexual_solicitation',
      reason: 'Commercial sexual solicitation or off-platform sex content promotion.',
      confidence: 'high',
      isSeverePredatory: false,
      isLegitimateContext: false,
      penaltySuggestion: '30_day_suspension',
    };
  }

  // Check general benign vulnerability terms
  for (const phrase of HUMAN_VULNERABILITY_PHRASES) {
    if (trimmed.toLowerCase().includes(phrase)) {
      return {
        isViolating: false,
        isSeriousSexualViolation: false,
        severity: 'none',
        confidence: 'none',
        isSeverePredatory: false,
        isLegitimateContext: false,
      };
    }
  }

  return {
    isViolating: false,
    isSeriousSexualViolation: false,
    severity: 'none',
    confidence: 'none',
    isSeverePredatory: false,
    isLegitimateContext: false,
  };
}
