import { useState } from "react";
import { useGraphQuery, useGraphSeed } from "../lib/graph";

export function GraphPage() {
  const [cypher, setCypher] = useState("MATCH (n) RETURN n LIMIT 25");
  const query = useGraphQuery();
  const seed = useGraphSeed();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Graph Explorer</h1>

      <div className="flex gap-2">
        <input
          type="text"
          value={cypher}
          onChange={(e) => setCypher(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500"
          placeholder="MATCH (n) RETURN n LIMIT 25"
        />
        <button
          onClick={() => query.mutate(cypher)}
          disabled={query.isPending}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {query.isPending ? "Running..." : "Run"}
        </button>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors"
        >
          {seed.isPending ? "Seeding..." : "Seed Data"}
        </button>
      </div>

      {query.isError && (
        <div className="bg-red-900/50 border border-red-800 rounded p-4 text-sm">
          Error: {query.error?.message ?? "Query failed"}
        </div>
      )}

      {query.isSuccess && (
        <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-xs overflow-auto max-h-96">
          {JSON.stringify(query.data, null, 2)}
        </pre>
      )}

      {seed.isSuccess && (
        <div className="bg-green-900/50 border border-green-800 rounded p-3 text-sm text-green-300">
          Seed completed — {JSON.stringify(seed.data)}
        </div>
      )}
    </div>
  );
}
