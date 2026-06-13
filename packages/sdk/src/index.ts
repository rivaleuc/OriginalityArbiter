import type { Address } from "viem";

export interface OriginalityVerdict {
  originality_score: number;
  is_original: boolean;
  reasoning: string;
  similar_sources: string;
  appealed: boolean;
}

export interface OADeployment {
  chainId: number;
  token: Address;
  vault: Address;
  genlayerContract: string;
}

export const rewardVaultAbi = [
  {
    type: "function",
    name: "reward",
    stateMutability: "nonpayable",
    inputs: [
      { name: "submissionKey", type: "uint256" },
      { name: "author", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "remainingRewards",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "rewardAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Rewarded",
    inputs: [
      { name: "submissionKey", type: "uint256", indexed: true },
      { name: "author", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
