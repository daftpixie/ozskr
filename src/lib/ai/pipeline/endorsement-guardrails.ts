/**
 * Endorsement Content Guardrails
 * Detects and blocks content that violates FTC, SEC, or platform regulations.
 *
 * Compliance targets:
 * - FTC 16 CFR §255: Endorsements must be clearly disclosed
 * - SEC: Token content must not imply investment/returns
 * - Platform TOS: Various platform-specific requirements
 */

import type { ModerationResult } from './moderation';
import { ModerationStatus } from '@/types/database';
import { logger } from '@/lib/utils/logger';

/**
 * Patterns that indicate investment/financial return language (SEC risk)
 * These are ALWAYS rejected — no exceptions.
 */
const INVESTMENT_PATTERNS: RegExp[] = [
  /\$HOPE\s+(will|is going to|shall)\s+(increase|rise|moon|pump|go up|appreciate)/i,
  /\$HOPE\s+(investment|return|roi|yield|profit|dividend)/i,
  /(invest|investing)\s+(in|into)\s+\$HOPE/i,
  /\$HOPE\s+(price|value)\s+(will|going to|prediction|forecast)/i,
  /(buy|purchase|accumulate)\s+\$HOPE\s+(before|while|now)/i,
  /(financial|monetary)\s+(returns?|gains?|profits?)\s+.*\$HOPE/i,
  /\$HOPE\s+.*\b(guaranteed|assured|certain|definite)\b/i,
  /\bnot financial advice\b.*\$HOPE/i, // Paradoxical — if you need this disclaimer, the content is likely problematic
  /\$HOPE\s+to the\s+(moon|mars|stars)/i,
];

/**
 * Patterns that indicate endorsement/sponsored content
 */
const ENDORSEMENT_PATTERNS: RegExp[] = [
  /\b(partner(ed|ship|ing)?|sponsored?|paid|promo(tion|ting)?|collab(orat(ion|ed|ing))?)\b/i,
  /\b(ambassador|affiliate|referral\s+code|discount\s+code|promo\s+code)\b/i,
  /\buse\s+(my|our|this)\s+(code|link)\b/i,
  /\b(check\s+out|try)\s+.*\b(link\s+in\s+bio|swipe\s+up)\b/i,
];

/**
 * Required endorsement disclosure tags
 */
const ENDORSEMENT_DISCLOSURES: RegExp[] = [
  /#ad\b/i,
  /#sponsored\b/i,
  /#partner\b/i,
  /#paid\b/i,
  /\bad\b\s*$/i, // "Ad" at end of post
  /\bsponsored\b/i,
  /\bpaid partnership\b/i,
];

/**
 * Check content for SEC-violating investment language about $HOPE
 */
export const checkInvestmentLanguage = (text: string): ModerationResult | null => {
  for (const pattern of INVESTMENT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      logger.warn('Investment language detected in content', {
        pattern: pattern.source,
        match: match[0],
      });

      return {
        status: ModerationStatus.REJECTED,
        details: {
          stage: 'endorsement-guardrails',
          rule: 'investment-language',
          pattern: pattern.source,
          match: match[0],
          reason: 'Content contains investment/financial return language about $HOPE. This violates SEC guidelines. $HOPE must be framed as a utility token only.',
        },
      };
    }
  }

  return null;
};

/**
 * Check content for endorsement language missing required disclosures
 */
export const checkEndorsementDisclosure = (text: string): ModerationResult | null => {
  // Check if content contains endorsement-like language
  const hasEndorsementContent = ENDORSEMENT_PATTERNS.some((pattern) =>
    pattern.test(text)
  );

  if (!hasEndorsementContent) {
    return null; // Not endorsement content — no disclosure needed
  }

  // Content looks like endorsement — check for required disclosure
  const hasDisclosure = ENDORSEMENT_DISCLOSURES.some((pattern) =>
    pattern.test(text)
  );

  if (!hasDisclosure) {
    logger.warn('Endorsement content missing disclosure', {
      text: text.slice(0, 100),
    });

    return {
      status: ModerationStatus.REJECTED,
      details: {
        stage: 'endorsement-guardrails',
        rule: 'missing-endorsement-disclosure',
        reason: 'Content appears to be endorsement/sponsored content but is missing required disclosure (#ad, #sponsored, or #partner). FTC 16 CFR §255 requires clear disclosure.',
      },
    };
  }

  return null; // Endorsement content with proper disclosure — OK
};

/**
 * Run all endorsement guardrail checks on content.
 *
 * Returns null if content passes all checks.
 * Returns ModerationResult with REJECTED status if content violates any rule.
 */
export const runEndorsementGuardrails = (text: string): ModerationResult | null => {
  // Check investment language first (most critical)
  const investmentResult = checkInvestmentLanguage(text);
  if (investmentResult) {
    return investmentResult;
  }

  // Check endorsement disclosures
  const endorsementResult = checkEndorsementDisclosure(text);
  if (endorsementResult) {
    return endorsementResult;
  }

  return null;
};
