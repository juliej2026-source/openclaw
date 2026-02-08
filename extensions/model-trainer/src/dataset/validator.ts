import type { TrainingPair } from "../types.js";

type ValidationResult = {
  valid: TrainingPair[];
  removed: number;
  reasons: Record<string, number>;
};

const MIN_RESPONSE_LENGTH = 10;
const MAX_RESPONSE_LENGTH = 50_000;
const MIN_PROMPT_LENGTH = 3;

/**
 * Validate and filter training pairs for quality.
 *
 * Removes:
 * - Pairs where assistant response is too short or too long
 * - Pairs with error messages in the response
 * - Duplicate pairs (by content hash)
 * - Pairs with empty user prompts
 */
export function validateDataset(pairs: TrainingPair[]): ValidationResult {
  const reasons: Record<string, number> = {};
  const seen = new Set<string>();

  function reject(reason: string): boolean {
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    return false;
  }

  const valid = pairs.filter((pair) => {
    // Must have at least one user and one assistant message
    const userMsg = pair.conversations.find((c) => c.role === "user");
    const assistantMsg = pair.conversations.find((c) => c.role === "assistant");
    if (!userMsg || !assistantMsg) {
      return reject("missing_role");
    }

    // Check prompt length
    if (userMsg.content.trim().length < MIN_PROMPT_LENGTH) {
      return reject("prompt_too_short");
    }

    // Check response length
    const responseLen = assistantMsg.content.trim().length;
    if (responseLen < MIN_RESPONSE_LENGTH) {
      return reject("response_too_short");
    }
    if (responseLen > MAX_RESPONSE_LENGTH) {
      return reject("response_too_long");
    }

    // Check for error patterns in the response
    const response = assistantMsg.content.toLowerCase();
    const errorPatterns = [
      "i'm sorry, i can't",
      "i cannot fulfill",
      "error occurred",
      "internal server error",
      "rate limit exceeded",
      "context length exceeded",
      "model not found",
    ];
    if (errorPatterns.some((p) => response.includes(p))) {
      return reject("error_response");
    }

    // Deduplicate by content hash (simple hash of user+assistant)
    const hash = `${userMsg.content.slice(0, 200)}|${assistantMsg.content.slice(0, 200)}`;
    if (seen.has(hash)) {
      return reject("duplicate");
    }
    seen.add(hash);

    return true;
  });

  return {
    valid,
    removed: pairs.length - valid.length,
    reasons,
  };
}
