# tok

An instant, offline token + cost counter for LLM text. Daily-use for anyone building with LLMs.

- **Offline & deterministic** — counts tokens locally via [`gpt-tokenizer`](https://www.npmjs.com/package/gpt-tokenizer). No network, no API key.
- **Files or stdin** — count a file, pipe text in, or pass multiple files for per-file counts plus a total.
- **Cost estimates** — optional `--cost` flag estimates input dollars from a small built-in pricing table.
- **Library too** — import `countTokens` / `estimateCost` in your own code.

## Install

```sh
# global CLI
npm install -g tok

# or as a project dependency / library
pnpm add tok
```

Requires Node.js >= 18.

## CLI usage

```sh
# count a file
tok prompt.md

# count piped stdin
cat prompt.md | tok
echo "hello world" | tok

# multiple files: per-file counts + a total
tok a.md b.md

# pick a model (selects the encoding)
tok -m gpt-4 prompt.md

# estimate input cost
tok --cost -m gpt-4o prompt.md

# machine-readable output
tok --json prompt.md
```

### Flags

| Flag | Description |
| --- | --- |
| `-m, --model <name>` | Model to count for (default `gpt-4o`). Selects the tiktoken encoding. |
| `--cost` | Estimate input `$` using the built-in approximate price table. |
| `--json` | Output machine-readable JSON. |
| `-h, --help` | Show help. |
| `-v, --version` | Show version. |

Exit codes: `0` on success, `2` on error (bad model, no input).

### `--json` shape

```json
{
  "model": "gpt-4o",
  "encoding": "o200k_base",
  "files": [{ "name": "prompt.md", "tokens": 42 }],
  "total": 42,
  "cost": {
    "available": true,
    "usd": 0.000105,
    "pricePerMTokUsd": 2.5,
    "note": "approximate input pricing; edit the table to suit your needs"
  }
}
```

## Models & encodings

`tok` always prints which encoding it used. Model names map to a tiktoken encoding:

- **`o200k_base`** — `gpt-4o`, `gpt-4.1`, `gpt-5`, the `o`-series (`o1`/`o3`/`o4`), and — **as an approximation** — `claude-*` and `gemini-*`.
- **`cl100k_base`** — `gpt-4` and `gpt-3.5`.

Counts are exact for OpenAI models. For Claude and Gemini there is no public local tokenizer, so `tok` approximates with the closest OpenAI encoding (`o200k_base`). Treat those counts as estimates, not ground truth.

## Pricing caveat

The `--cost` table is a small, hand-maintained set of **approximate** input prices (USD per 1M tokens) for common models:

`gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `o3`, `claude-3.5-sonnet`, `claude-3.5-haiku`, `gemini-2.0-flash`.

These figures are a rough gut-check, not billing — providers change prices often. Edit `src/models.ts` to suit your needs. If a model is not in the table, `tok` reports cost as unavailable.

## Library API

```ts
import { countTokens, estimateCost, resolveEncoding } from "tok";

countTokens("hello world");              // => number (uses gpt-4o by default)
countTokens("hello world", "gpt-4");     // => number (uses cl100k_base)

resolveEncoding("claude-3.5-sonnet");    // => "o200k_base"

const tokens = countTokens(text, "gpt-4o");
const cost = estimateCost(tokens, "gpt-4o");
// => { usd: number | undefined, available: boolean, pricePerMTok: number | undefined }
```

## License

MIT © 2026 Abdulmunim Jemal
