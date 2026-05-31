#!/usr/bin/env node
/**
 * tokcost CLI — count tokens (and optionally estimate input cost) for LLM text.
 *
 * Usage:
 *   tokcost prompt.md                 count a file
 *   cat file | tokcost                count piped stdin
 *   echo "hi" | tokcost               count stdin
 *   tokcost a.md b.md                 per-file counts + a total
 *
 * Exit codes: 0 ok, 2 on error (bad model / no input).
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import pc from "picocolors";

import {
  DEFAULT_MODEL,
  countTokens,
  estimateCost,
  resolveEncoding,
} from "./index.js";

const VERSION = "0.1.0";

const HELP = `tokcost — an instant, offline token + cost counter for LLM text

Usage:
  tokcost [options] [files...]
  cat file.md | tokcost [options]

Options:
  -m, --model <name>   Model to count for (default: ${DEFAULT_MODEL}).
                       Selects the tiktoken encoding.
      --cost           Estimate input $ using a built-in approximate price table.
      --json           Output machine-readable JSON.
  -h, --help           Show this help.
  -v, --version        Show version.

Notes:
  Counting is offline and deterministic (no network, no API key).
  Encodings: o200k_base for gpt-4o/4.1/5/o-series and (approx) claude-*/gemini-*;
  cl100k_base for gpt-4/3.5. Counts for non-OpenAI models are approximate.
  Cost figures are rough, editable estimates — not billing.
`;

interface FileResult {
  name: string;
  tokens: number;
}

function fail(message: string): never {
  process.stderr.write(`${pc.red("error")}: ${message}\n`);
  process.exit(2);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function formatUsd(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        model: { type: "string", short: "m" },
        cost: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const { values, positionals } = parsed;

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const model = values.model ?? DEFAULT_MODEL;
  const encoding = resolveEncoding(model);
  const useColor = process.stdout.isTTY && !values.json;
  const dim = (s: string) => (useColor ? pc.dim(s) : s);
  const bold = (s: string) => (useColor ? pc.bold(s) : s);

  // Gather inputs: positional files, or stdin when piped.
  const results: FileResult[] = [];

  if (positionals.length > 0) {
    for (const file of positionals) {
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch (err) {
        fail(
          `cannot read '${file}': ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      results.push({ name: file, tokens: countTokens(text, model) });
    }
  } else if (!process.stdin.isTTY) {
    const text = await readStdin();
    if (text.length === 0) {
      fail("no input (stdin was empty)");
    }
    results.push({ name: "<stdin>", tokens: countTokens(text, model) });
  } else {
    fail("no input — pass a file or pipe text on stdin (see --help)");
  }

  const total = results.reduce((sum, r) => sum + r.tokens, 0);
  const cost = values.cost ? estimateCost(total, model) : undefined;

  if (values.json) {
    const out: Record<string, unknown> = {
      model,
      encoding,
      files: results,
      total,
    };
    if (cost) {
      out.cost = {
        available: cost.available,
        usd: cost.usd ?? null,
        pricePerMTokUsd: cost.pricePerMTok ?? null,
        note: "approximate input pricing; edit the table to suit your needs",
      };
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return;
  }

  // Human-readable output.
  const multiple = results.length > 1;
  for (const r of results) {
    const count = bold(String(r.tokens));
    if (multiple) {
      process.stdout.write(`${count}\t${r.name}\n`);
    } else {
      process.stdout.write(`${count} tokens ${dim(`(${r.name})`)}\n`);
    }
  }
  if (multiple) {
    process.stdout.write(`${bold(String(total))}\ttotal\n`);
  }

  process.stdout.write(dim(`model: ${model}  encoding: ${encoding}\n`));

  if (cost) {
    if (cost.available && cost.usd !== undefined) {
      process.stdout.write(
        `${dim("≈")} ${bold(formatUsd(cost.usd))} (input)${dim(
          "  — approximate, editable pricing",
        )}\n`,
      );
    } else {
      process.stdout.write(
        dim(`cost unavailable — model '${model}' is not in the pricing table\n`),
      );
    }
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
