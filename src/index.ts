/**
 * tokcost — an instant, offline token + cost counter for LLM text.
 *
 * Public library API. Counting is offline and deterministic via gpt-tokenizer;
 * no network and no API key are required.
 */

import { encode as encodeO200k } from "gpt-tokenizer/encoding/o200k_base";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";

import {
  type EncodingName,
  lookupInputPrice,
  resolveEncoding,
} from "./models.js";

export {
  type EncodingName,
  resolveEncoding,
  lookupInputPrice,
  INPUT_PRICE_PER_MTOK,
} from "./models.js";

/** The default model used when none is supplied. */
export const DEFAULT_MODEL = "gpt-4o";

/**
 * Count the number of tokens in `text` for the given `model`.
 *
 * The model selects the tiktoken encoding (see `resolveEncoding`). Empty input
 * returns 0. Counting is deterministic and offline.
 */
export function countTokens(text: string, model: string = DEFAULT_MODEL): number {
  if (text.length === 0) return 0;
  const encoding = resolveEncoding(model);
  const encode = encoding === "cl100k_base" ? encodeCl100k : encodeO200k;
  return encode(text).length;
}

/** Result of an `estimateCost` call. */
export interface CostEstimate {
  /** USD cost estimate, or `undefined` if the model is not in the pricing table. */
  usd: number | undefined;
  /** Whether a price was found for the model. */
  available: boolean;
  /** The input price (USD per 1M tokens) used, if available. */
  pricePerMTok: number | undefined;
}

/**
 * Estimate the input cost in USD for `tokens` tokens of the given `model`,
 * using the built-in approximate pricing table.
 *
 * Returns `{ available: false }` when the model is unknown to the table.
 */
export function estimateCost(tokens: number, model: string): CostEstimate {
  const pricePerMTok = lookupInputPrice(model);
  if (pricePerMTok === undefined) {
    return { usd: undefined, available: false, pricePerMTok: undefined };
  }
  return {
    usd: (tokens / 1_000_000) * pricePerMTok,
    available: true,
    pricePerMTok,
  };
}
