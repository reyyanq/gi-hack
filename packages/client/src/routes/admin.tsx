import { createFileRoute } from "@tanstack/react-router";
import {
  useSources,
  useGraphHealth,
  useGraphStats,
  useTierCounts,
  useSeed,
  useIngest,
  useRunScoring,
  type SourceInfo,
} from "../lib/graph";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({ source, onRun, isRunning }: {
  source: SourceInfo;
  onRun: () => void;
  isRunning: boolean;
}) {
  const statusColor =
    source.status === "ok"    ? "#22c55e" :
    source.status === "error" ? "#ef4444" : "#555";

  const statusLabel =
    source.status === "ok"    ? "OK" :
    source.status === "error" ? "Error" : "Idle";

  return (
    <div style={{
      backgroundColor: "#1a2035",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{source.name}</div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
            Weight: <span style={{ color: "#888" }}>{source.weight}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            backgroundColor: statusColor,
            display: "inline-block",
            boxShadow: source.status === "ok" ? `0 0 0 3px rgba(34,197,94,0.2)` : undefined,
          }} />
          <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#444" }}>
        {source.recordsFetched != null && (
          <span>Records: <span style={{ color: "#777" }}>{source.recordsFetched}</span></span>
        )}
        {source.lastRun && (
          <span>Last run: <span style={{ color: "#777" }}>
            {new Date(source.lastRun).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span></span>
        )}
      </div>

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={isRunning}
        style={{
          padding: "7px 12px",
          borderRadius: 7,
          border: "1px solid rgba(99,102,241,0.3)",
          backgroundColor: isRunning ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.12)",
          color: isRunning ? "#555" : "#818cf8",
          fontSize: 12, fontWeight: 600,
          cursor: isRunning ? "not-allowed" : "pointer",
          transition: "all 0.15s",
          width: "100%",
        }}
      >
        {isRunning ? "⏳ Running…" : "▶ Run Ingest"}
      </button>
    </div>
  );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "9px 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      fontSize: 13,
    }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ?? "#ccc" }}>{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { data: sources = [], isLoading: sourcesLoading } = useSources();
  const { data: health } = useGraphHealth();
  const { data: stats } = useGraphStats();
  const { counts, isLoading: countsLoading } = useTierCounts();

  const seed    = useSeed();
  const ingest  = useIngest();
  const scoring = useRunScoring();

  const neo4jOk = health?.status === "ok";

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Admin Panel</h1>
        <p style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
          Ingest controls, scoring, and system health
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>

        {/* ── Left: Sources ── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#444", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 14 }}>
            Data Sources ({sources.length})
          </div>

          {sourcesLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: 120, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div style={{
              padding: 32, textAlign: "center", fontSize: 13, color: "#444",
              backgroundColor: "#161b27", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
            }}>
              No sources registered. Seed the ontology first.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {sources.map((source) => (
                <SourceCard
                  key={source.name}
                  source={source}
                  isRunning={ingest.isPending}
                  onRun={() => ingest.mutate(source.name)}
                />
              ))}
            </div>
          )}

          {/* Global ingest button */}
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button
              onClick={() => ingest.mutate()}
              disabled={ingest.isPending}
              style={{
                flex: 1, padding: "11px 16px", borderRadius: 10,
                border: "1px solid rgba(99,102,241,0.35)",
                backgroundColor: ingest.isPending ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.15)",
                color: ingest.isPending ? "#555" : "#a5b4fc",
                fontSize: 13, fontWeight: 700,
                cursor: ingest.isPending ? "not-allowed" : "pointer",
              }}
            >
              {ingest.isPending ? "⏳ Running all sources…" : "▶ Run All Sources"}
            </button>
            <button
              onClick={() => scoring.mutate()}
              disabled={scoring.isPending}
              style={{
                flex: 1, padding: "11px 16px", borderRadius: 10,
                border: "1px solid rgba(234,179,8,0.3)",
                backgroundColor: scoring.isPending ? "rgba(234,179,8,0.04)" : "rgba(234,179,8,0.08)",
                color: scoring.isPending ? "#555" : "#fbbf24",
                fontSize: 13, fontWeight: 700,
                cursor: scoring.isPending ? "not-allowed" : "pointer",
              }}
            >
              {scoring.isPending ? "⏳ Scoring…" : "🎯 Recalculate Scores"}
            </button>
          </div>

          {/* Feedback */}
          {(ingest.isSuccess || scoring.isSuccess || seed.isSuccess) && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 12,
              color: "#22c55e", backgroundColor: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.15)",
            }}>
              ✓ Operation completed successfully
            </div>
          )}
          {(ingest.isError || scoring.isError || seed.isError) && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 12,
              color: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.15)",
            }}>
              ✗ Error occurred — check the server logs
            </div>
          )}
        </div>

        {/* ── Right: Stats & Health ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Neo4j Health */}
          <div style={{
            backgroundColor: "#161b27",
            border: `1px solid ${neo4jOk ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#444", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 12 }}>
              System Health
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                backgroundColor: neo4jOk ? "#22c55e" : "#ef4444",
                boxShadow: neo4jOk ? "0 0 0 3px rgba(34,197,94,0.25)" : undefined,
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: neo4jOk ? "#86efac" : "#fca5a5" }}>
                  Neo4j {neo4jOk ? "Connected" : "Disconnected"}
                </div>
                {health?.message && (
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{health.message}</div>
                )}
              </div>
            </div>
          </div>

          {/* Scoring Summary */}
          <div style={{ backgroundColor: "#161b27", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#444", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>
              Scoring Summary
            </div>
            {countsLoading ? (
              <div style={{ height: 80, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", marginTop: 12 }} />
            ) : (
              <>
                <StatRow label="🔥 Hot (≥70)"  value={counts.HOT}  accent="#f97316" />
                <StatRow label="⭐ Warm (40–69)" value={counts.WARM} accent="#eab308" />
                <StatRow label="❄️ Cold (<40)"  value={counts.COLD} accent="#60a5fa" />
                <StatRow label="Total scored"   value={counts.total} />
              </>
            )}
          </div>

          {/* Graph Stats */}
          <div style={{ backgroundColor: "#161b27", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#444", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>
              Neo4j Node Stats
            </div>
            <StatRow label="Companies"    value={stats?.companies    ?? "—"} />
            <StatRow label="Signals"      value={stats?.signals      ?? "—"} />
            <StatRow label="Applications" value={stats?.applications ?? "—"} />
            <StatRow label="Products"     value={stats?.products     ?? "—"} />
          </div>

          {/* Seed button */}
          <button
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
            style={{
              padding: "11px 16px", borderRadius: 10,
              border: "1px solid rgba(34,197,94,0.3)",
              backgroundColor: seed.isPending ? "rgba(34,197,94,0.04)" : "rgba(34,197,94,0.08)",
              color: seed.isPending ? "#555" : "#86efac",
              fontSize: 13, fontWeight: 700,
              cursor: seed.isPending ? "not-allowed" : "pointer",
            }}
          >
            {seed.isPending ? "⏳ Seeding…" : "🌱 Seed Ontology"}
          </button>
        </div>
      </div>
    </div>
  );
}
