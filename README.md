# OriginalityArbiter

Decentralized content originality scoring. AI validators judge whether submissions are genuinely original or plagiarized/AI-generated, and authors of original work earn token rewards.

## Why this exists

Content platforms need moderation. Centralized moderation doesn't scale and is biased. OriginalityArbiter replaces it with decentralized AI consensus: multiple validators independently evaluate content originality, reaching agreement through GenLayer's equivalence principle. No single judge, no single point of failure.

## How it works

```
┌─────────────────────┐         ┌──────────────────────────────┐
│    RewardVault      │         │   OriginalityArbiter.py      │
│    (Base / EVM)     │◄────────│   (GenLayer)                 │
│                     │  reads  │                              │
│  • reward(key,addr) │ verdict │  • submit(content, type)     │
│  • claimed(key)     │         │  • appeal(key)               │
│                     │         │  • read_reward_eligibility() │
└─────────────────────┘         └──────────────────────────────┘
         ▲                                   ▲
         │                                   │
    OAT tokens paid                   AI validators score
    to original authors               originality 0-100
```

1. Author submits content → GenLayer AI validators score originality (0-100)
2. Score ≥ 40 → marked as original, eligible for OAT rewards
3. Score < 40 → rejected (likely plagiarized or AI-generated without value)
4. Author can appeal for fresh evaluation
5. Resolver reads verdict → pays OAT from RewardVault to eligible authors

## Deployed

- **GenLayer (Bradbury):** `0xEDf0e9B44b609f63aE17d1345C1e5dDF81000BdE`
- **Network:** Bradbury Testnet (chain 4221)

## Architecture

- `genlayer/` — Intelligent contract: content submission, AI originality judgment, appeal
- `contracts/` — EVM: `OATToken` (ERC-20) + `RewardVault` (pays original authors)
- `packages/sdk/` — TypeScript ABIs and types
- `web/` — Next.js + wagmi + RainbowKit submission interface

## Quick start

```bash
pnpm install
cd contracts && forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
forge test -vv
cd .. && pnpm dev
```
