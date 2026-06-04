import { createFileRoute } from "@tanstack/react-router";
import { useGraphHealth } from "../lib/graph";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: health } = useGraphHealth();

  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">
          AI + Graph + <span className="text-cyan-400">TanStack</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Boilerplate ready for the StartMiUp Hackathon. Neo4j backend, AI
          integration, type-safe React frontend.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">Graph Explorer</h2>
          <p className="text-gray-400 text-sm mb-3">
            Query your Neo4j database with Cypher, see results in real time.
          </p>
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${health?.data?.connected ? "bg-green-400" : "bg-red-400"}`}
          />
          <span className="text-xs text-gray-500">
            Neo4j {health?.data?.connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">AI Chat</h2>
          <p className="text-gray-400 text-sm mb-3">
            Chat with AI leveraging graph context for smarter answers.
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">Type-Safe Routes</h2>
          <p className="text-gray-400 text-sm mb-3">
            TanStack Router with full type safety across all pages.
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Quick Start</h2>
        <pre className="text-sm text-green-400 bg-gray-950 p-4 rounded overflow-x-auto">
{`docker compose up -d neo4j
cp .env.example .env   # Add your OpenAI key
npm install
npm run dev`}
        </pre>
      </div>
    </div>
  );
}
