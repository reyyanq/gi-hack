import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAskAI } from "../lib/ai";

export const Route = createLazyFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [useGraph, setUseGraph] = useState(false);
  const ask = useAskAI();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    ask.mutate({ prompt, useGraphContext: useGraph });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">AI Chat</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="Ask anything... (e.g., 'What do you know about our hackathon team?')"
        />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useGraph}
              onChange={(e) => setUseGraph(e.target.checked)}
              className="accent-cyan-500"
            />
            Include graph context
          </label>

          <button
            type="submit"
            disabled={ask.isPending || !prompt.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 ml-auto px-6 py-2 rounded text-sm font-medium transition-colors"
          >
            {ask.isPending ? "Thinking..." : "Ask AI"}
          </button>
        </div>
      </form>

      {ask.isError && (
        <div className="bg-red-900/50 border border-red-800 rounded p-4 text-sm">
          Error: {ask.error?.message ?? "AI request failed"}
        </div>
      )}

      {ask.isSuccess && (
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <div className="text-xs text-gray-500 mb-2">AI Response:</div>
          <div className="text-sm whitespace-pre-wrap">{ask.data.data?.answer}</div>
        </div>
      )}
    </div>
  );
}
