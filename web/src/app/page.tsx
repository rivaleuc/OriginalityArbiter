"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("article");
  const [sourceUrl, setSourceUrl] = useState("");
  const [result, setResult] = useState<any>(null);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold">🤖 OriginalityArbiter</h1>
          <ConnectButton />
        </div>

        {isConnected ? (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold">Submit Content for Originality Check</h2>
              <p className="text-gray-400 text-sm">
                AI validators judge your content&apos;s originality. Score ≥40 = eligible for OAT rewards.
              </p>
              <select
                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
              >
                <option value="article">Article</option>
                <option value="code">Code</option>
                <option value="design">Design</option>
                <option value="tweet">Tweet/Thread</option>
                <option value="research">Research</option>
              </select>
              <textarea
                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 h-40 resize-none"
                placeholder="Paste your content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={4000}
              />
              <input
                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500"
                placeholder="Source URL (optional)"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              <button
                className="w-full bg-purple-600 hover:bg-purple-700 rounded-lg px-4 py-3 font-semibold transition"
                onClick={() => setResult({ pending: true })}
              >
                Submit for Judgment
              </button>
              {result?.pending && (
                <p className="text-yellow-400 text-sm">⏳ Awaiting AI consensus...</p>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-2">How it works</h2>
              <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                <li>Submit your content (article, code, design...)</li>
                <li>GenLayer AI validators score originality (0-100)</li>
                <li>Score ≥ 40 → eligible for OAT token rewards</li>
                <li>Disagree? Appeal for a fresh evaluation</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-xl">Connect your wallet to submit content</p>
          </div>
        )}
      </div>
    </main>
  );
}
