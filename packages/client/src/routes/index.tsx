import { useGraphHealth } from "../lib/graph";

export function HomePage() {
  const { data: health } = useGraphHealth();

  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">
          <span className="text-cyan-400">LeadGraph</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          AI-driven lead identification for biological intermediates —
          discovering and prioritizing diagnostic companies for Siemens
          Healthineers.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-cyan-400 font-semibold">Graph Connected</h2>
            <span className={`inline-block w-2 h-2 rounded-full ${health?.connected ? "bg-green-400" : "bg-red-400"}`} />
          </div>
          <p className="text-gray-400 text-sm">
            Neo4j {health?.connected ? "Connected" : "Disconnected"} — {health?.connected ? "ready for ingestion" : "check docker compose"}
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">Lead Explorer</h2>
          <p className="text-gray-400 text-sm mb-3">
            Score-sorted leads with tier badges, signal timelines, and AI-generated outreach hooks.
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-cyan-400 font-semibold mb-2">Pipeline CRM</h2>
          <p className="text-gray-400 text-sm mb-3">
            Kanban pipeline with stage transitions, contacts, and activity tracking.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <a href="/leads" className="bg-cyan-600 hover:bg-cyan-500 text-center py-3 rounded-lg font-medium transition-colors">
          View Leads
        </a>
        <a href="/pipeline" className="bg-gray-700 hover:bg-gray-600 text-center py-3 rounded-lg font-medium transition-colors">
          Pipeline
        </a>
        <a href="/admin" className="bg-gray-700 hover:bg-gray-600 text-center py-3 rounded-lg font-medium transition-colors">
          Admin
        </a>
      </div>
    </div>
  );
}
