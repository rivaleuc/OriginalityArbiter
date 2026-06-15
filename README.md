# OriginalityArbiter

**Content originality scored by AI consensus, with token rewards for genuinely original work.**

OriginalityArbiter judges whether submitted content is original or plagiarized/AI-generated-without-attribution, assigning a 0–100 originality score by validator consensus. Original submissions become eligible for on-chain token rewards. The judgment is a living interpretation of voice, novelty, and similarity — not a fixed hash comparison.

- **Contract (Bradbury, chain 4221):** `0xEDf0e9B44b609f63aE17d1345C1e5dDF81000BdE`
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0xEDf0e9B44b609f63aE17d1345C1e5dDF81000BdE
- **Live app:** https://originalityarbiter.pages.dev

## What it does

An author calls `submit(content, content_type, source_url)` (content capped at 4000 chars). The contract runs a judgment round and stores a record under an integer key (returned as a string): `{author, content_preview, content_type, source_url, originality_score, is_original, reasoning, similar_sources, appealed}`. It increments `submission_count` and bumps `total_rewarded` or `total_rejected` based on the verdict. The original author can `appeal(key)` to re-judge with a fresh web search; if the verdict flips, the contract corrects the `total_rewarded` / `total_rejected` counters accordingly.

Each round runs in `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`. When a `source_url` is provided, the leader crawls it with `gl.nondet.web.get(source_url)` (clamped to 5000 chars) to compare the submission against where it's published. It then calls `gl.nondet.exec_prompt(..., response_format="json")` to score originality 0–100, flag plagiarism/wholesale AI generation, and judge unique voice and novel analysis — with the rule that `score >= 40` (the `PLAGIARISM_THRESHOLD`) counts as original. The `validator_fn` re-parses the leader's calldata and accepts only if `originality_score` is an int in 0–100, `is_original` is a bool, and `reasoning` is a string, so validators converge on the verdict shape rather than identical scores.

State lives in a `TreeMap[str, str]` (`submissions`). The frontend reads with `get_submission(key)` and aggregate `stats()`. A reward distributor reads the purpose-built view `read_reward_eligibility(key)` — `{eligible, author, score, key}` — and the EVM `RewardVault.sol` pays the author OAT tokens via its resolver-gated `reward()` (each submission key can be claimed once).

## Why GenLayer

Originality is irreducibly subjective: it depends on voice, novelty, and whether referencing others still adds genuine value — none of which a deterministic VM can measure. A hash or diff catches verbatim copies but misses paraphrase, unattributed AI generation, or genuinely transformative work. The source material also lives on the open web and changes over time. GenLayer lets validators crawl the source, read the submission, and reach agreement on a semantically-equivalent score even when individual numbers differ, with `appeal` re-judging against fresh evidence. Use GenLayer when "is this original?" needs human-like reading of evolving content; use a plain backend when an exact-match dedupe check is all you need.

## Architecture

| Layer | Responsibility |
|---|---|
| Intelligent contract (`genlayer/originality_arbiter.py`) | Crawls the source URL, runs LLM originality rounds, stores scored records in a `TreeMap`, exposes `read_reward_eligibility`, supports `appeal` |
| Frontend (`web/`) | Reads live submissions/stats with no wallet; submits `submit` / `appeal` writes via MetaMask |
| EVM / off-chain (`contracts/src/RewardVault.sol`, `OATToken.sol`) | Reward distribution: a resolver reads `read_reward_eligibility` and calls `reward(submissionKey, author)`; OAT is the ERC-20 paid out |

## Tech

- **Contract:** GenVM Python runner, pinned (`py-genlayer:1jb45aa8…jpz09h6`). Counters as `u256`, submissions stored as a `TreeMap[str, str]` of JSON. Web evidence via `gl.nondet.web.get`, scoring via `gl.nondet.exec_prompt`, consensus via `gl.vm.run_nondet_unsafe` + structural `validator_fn`. Originality score is an integer 0–100 (no floats); threshold is `40`.
- **Frontend:** Vite + React 19 + TypeScript, genlayer-js for reads (CORS-open RPC) and writes (MetaMask wallet on chain 4221, no snap — the client is created with the address as a string so writes route to `eth_sendTransaction`). UI uses Tailwind CSS v4, framer-motion animations, and sonner toasts.

## Project structure

```
OriginalityArbiter/
├── genlayer/
│   └── originality_arbiter.py  # intelligent contract (gl.Contract)
├── contracts/
│   ├── src/
│   │   ├── RewardVault.sol      # pays OAT to original authors
│   │   └── OATToken.sol         # ERC-20 reward token
│   ├── test/RewardVault.t.sol
│   └── foundry.toml
├── packages/sdk/                # shared TS SDK
├── web/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── genlayer.ts          # client, connectWallet, read/write helpers
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Develop

```
cd web
npm install
npm run dev
npm run build
```

The frontend reads contract state with no wallet. Writes require MetaMask on GenLayer Bradbury (chain 4221) with some GEN — the app auto-switches the network.

## Deploy the frontend (Cloudflare Pages)

- **Root directory:** web
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment:** `NODE_VERSION=20`

## Why GenLayer (engineering notes)

- **No floats — score is an int 0–100.** The originality score and threshold (`40`) are integers, and counters are `u256`; nothing fractional is serialized into storage or calldata.
- **Validate structure, not exact text.** Validators will produce different scores and wording, so `validator_fn` checks `originality_score` is an int in range, `is_original` is a bool, and `reasoning` is a string — converging on the verdict shape, not a number.
- **Evidence is untrusted.** The crawled source page is data, not instructions; the judgment criteria sit in the prompt body, treating fetched content as material to compare against (greybox against prompt injection).
- **ACCEPTED ≠ paid.** A finalized submission stores a score; it pays nothing. `RewardVault` separately gates a one-time `reward()` per submission key via its resolver.
- **Optimistic finality paces writes.** The frontend waits for `FINALIZED` receipts; verdicts settle on the appeal-window cadence, and `appeal` re-judges against fresh web evidence (the contract reconciles counters if the verdict flips).

## License

MIT
