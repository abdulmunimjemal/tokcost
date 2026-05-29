import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL,
  countTokens,
  estimateCost,
  lookupInputPrice,
  resolveEncoding,
} from "../src/index.js";

describe("countTokens", () => {
  it("returns a deterministic, positive count for non-empty text", () => {
    const a = countTokens("hello world");
    const b = countTokens("hello world");
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it("returns 0 for the empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("defaults to the gpt-4o model", () => {
    expect(countTokens("hello world")).toBe(countTokens("hello world", DEFAULT_MODEL));
  });

  it("counts more tokens for longer text", () => {
    const short = countTokens("hi");
    const long = countTokens("hi there, this is a longer sentence with more words");
    expect(long).toBeGreaterThan(short);
  });
});

describe("resolveEncoding", () => {
  it("maps modern OpenAI models to o200k_base", () => {
    expect(resolveEncoding("gpt-4o")).toBe("o200k_base");
    expect(resolveEncoding("gpt-4o-mini")).toBe("o200k_base");
    expect(resolveEncoding("gpt-4.1")).toBe("o200k_base");
    expect(resolveEncoding("gpt-5")).toBe("o200k_base");
    expect(resolveEncoding("o3")).toBe("o200k_base");
    expect(resolveEncoding("o1-mini")).toBe("o200k_base");
  });

  it("maps gpt-4 and gpt-3.5 to cl100k_base", () => {
    expect(resolveEncoding("gpt-4")).toBe("cl100k_base");
    expect(resolveEncoding("gpt-4-turbo")).toBe("cl100k_base");
    expect(resolveEncoding("gpt-3.5-turbo")).toBe("cl100k_base");
  });

  it("approximates claude and gemini with o200k_base", () => {
    expect(resolveEncoding("claude-3.5-sonnet")).toBe("o200k_base");
    expect(resolveEncoding("gemini-2.0-flash")).toBe("o200k_base");
  });

  it("is case-insensitive and prefix-based for versioned names", () => {
    expect(resolveEncoding("GPT-4O")).toBe("o200k_base");
    expect(resolveEncoding("gpt-4o-2024-08-06")).toBe("o200k_base");
    expect(resolveEncoding("claude-3.5-sonnet-20241022")).toBe("o200k_base");
  });

  it("defaults unknown models to o200k_base", () => {
    expect(resolveEncoding("some-future-model")).toBe("o200k_base");
  });

  it("selects different encodings that can yield different counts", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const modern = countTokens(text, "gpt-4o");
    const legacy = countTokens(text, "gpt-4");
    expect(modern).toBeGreaterThan(0);
    expect(legacy).toBeGreaterThan(0);
  });
});

describe("estimateCost", () => {
  it("computes cost as tokens / 1M * pricePerMTok", () => {
    const result = estimateCost(1_000_000, "gpt-4o");
    expect(result.available).toBe(true);
    expect(result.pricePerMTok).toBe(2.5);
    expect(result.usd).toBeCloseTo(2.5, 10);
  });

  it("scales linearly with token count", () => {
    const result = estimateCost(500_000, "gpt-4o-mini");
    // 0.15 / 1M * 500k = 0.075
    expect(result.usd).toBeCloseTo(0.075, 10);
  });

  it("returns zero cost for zero tokens of a known model", () => {
    const result = estimateCost(0, "claude-3.5-sonnet");
    expect(result.available).toBe(true);
    expect(result.usd).toBe(0);
  });

  it("reports unavailable for unknown models", () => {
    const result = estimateCost(1000, "totally-unknown-model");
    expect(result.available).toBe(false);
    expect(result.usd).toBeUndefined();
    expect(result.pricePerMTok).toBeUndefined();
  });

  it("resolves versioned model names via prefix", () => {
    const result = estimateCost(1_000_000, "claude-3.5-sonnet-20241022");
    expect(result.available).toBe(true);
    expect(result.usd).toBeCloseTo(3.0, 10);
  });
});

describe("lookupInputPrice", () => {
  it("returns the table price for known models", () => {
    expect(lookupInputPrice("gpt-4o")).toBe(2.5);
    expect(lookupInputPrice("gemini-2.0-flash")).toBe(0.1);
  });

  it("returns undefined for unknown models", () => {
    expect(lookupInputPrice("nope-9000")).toBeUndefined();
  });
});
