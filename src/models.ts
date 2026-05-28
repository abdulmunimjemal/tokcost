/**
 * Model -> tiktoken encoding resolution and an approximate input-pricing table.
 *
 * Token counting is exact only for OpenAI models. For Claude and Gemini we
 * approximate with the closest OpenAI encoding (o200k_base); treat those counts
 * as estimates, not ground truth.
 */

export type EncodingName = "o200k_base" | "cl100k_base";

/**
 * Resolve a model name to a tiktoken encoding.
 *
 * - o200k_base: gpt-4o / gpt-4.1 / gpt-5 / o-series, and (approximately)
 *   claude-* and gemini-* models.
 * - cl100k_base: gpt-4 and gpt-3.5.
 *
 * The match is prefix-based and case-insensitive so versioned names like
 * `gpt-4o-2024-08-06` or `claude-3.5-sonnet-latest` resolve correctly.
 */
export function resolveEncoding(model: string): EncodingName {
  const m = model.trim().toLowerCase();

  // Older OpenAI families use cl100k_base. Check these before the broad
  // gpt-4o / gpt-4.x prefixes so "gpt-4" and "gpt-3.5" land here.
  if (m.startsWith("gpt-3.5") || m === "gpt-4" || m.startsWith("gpt-4-")) {
    return "cl100k_base";
  }

  // Everything modern (and our Claude/Gemini approximation) uses o200k_base.
  if (
    m.startsWith("gpt-4o") ||
    m.startsWith("gpt-4.1") ||
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4") ||
    m.startsWith("chatgpt-4o") ||
    m.startsWith("claude") ||
    m.startsWith("gemini")
  ) {
    return "o200k_base";
  }

  // Unknown model: default to the modern encoding.
  return "o200k_base";
}

/**
 * Approximate input price in USD per 1,000,000 tokens.
 *
 * These are rough, hand-maintained figures meant for a quick gut-check, not
 * billing. Providers change pricing often. Edit this table to suit your needs.
 */
export const INPUT_PRICE_PER_MTOK: Readonly<Record<string, number>> = {
  "gpt-4o": 2.5,
  "gpt-4o-mini": 0.15,
  "gpt-4.1": 2.0,
  o3: 2.0,
  "claude-3.5-sonnet": 3.0,
  "claude-3.5-haiku": 0.8,
  "gemini-2.0-flash": 0.1,
};

/**
 * Look up the approximate input price (USD per 1M tokens) for a model.
 *
 * Matches exact names first, then a normalized/prefix form so versioned names
 * (e.g. `claude-3.5-sonnet-20241022`) still resolve. Returns `undefined` when
 * the model is not in the table.
 */
export function lookupInputPrice(model: string): number | undefined {
  const exact = INPUT_PRICE_PER_MTOK[model];
  if (exact !== undefined) return exact;

  const m = model.trim().toLowerCase();
  if (INPUT_PRICE_PER_MTOK[m] !== undefined) return INPUT_PRICE_PER_MTOK[m];

  for (const key of Object.keys(INPUT_PRICE_PER_MTOK)) {
    if (m.startsWith(key)) return INPUT_PRICE_PER_MTOK[key];
  }
  return undefined;
}
