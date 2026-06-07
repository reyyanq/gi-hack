import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useTierCounts,
  useTopLeads,
  useGraphStats,
  type TierLevel,
} from "../lib/graph";

// @ts-ignore - TanStack Router type definition issue
export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const tierConfig: Record<TierLevel, { label: string; color: string; bg: string; glow: string }> = {
  HOT:  { label: "🔥 Hot",  color: "#f97316", bg: "rgba(249,115,22,0.1)",  glow: "rgba(249,115,22,0.2)" },
  WARM: { label: "⭐ Warm", color: "#eab308", bg: "rgba(234,179,8,0.1)",   glow: "rgba(234,179,8,0.2)" },
  COLD: { label: "❄️ Cold", color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  glow: "rgba(96,165,250,0.2)" },
};

function TierBadge({ tier }: { tier: TierLevel }) {
  const c = tierConfig[tier];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      color: c.color, backgroundColor: c.bg, border: `1px solid ${c.glow}`,
      letterSpacing: "0.3px",
    }}>
      {tier}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, color, isLoading,
}: {
  label: string; value: number | string; sub?: string;
  color: string; isLoading?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: "#161b27",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      flex: 1,
    }}>
      <div style={{ fontSize: 12, color: "#888", fontWeight: 500, letterSpacing: "0.4px", textTransform: "uppercase" }}>{label}</div>
      {isLoading ? (
        <div style={{ height: 36, width: 60, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)", animation: "pulse 1.5s ease-in-out infinite" }} />
      ) : (
        <div style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      )}
      {sub && <div style={{ fontSize: 12, color: "#888" }}>{sub}</div>}
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, tier }: { score: number; tier: TierLevel }) {
  const color = tierConfig[tier].color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)" }}>
        <div style={{
          width: `${score}%`, height: "100%", borderRadius: 2,
          backgroundColor: color, transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {

  const { counts, isLoading: scoresLoading } = useTierCounts();
  const { leads: topLeads, isLoading: leadsLoading } = useTopLeads(5);
  const { data: stats } = useGraphStats();

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>
          Lead Intelligence Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          Siemens Healthineers · Biological Intermediates B2B Pipeline
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <SummaryCard label="Total Companies" value={counts.total} sub="in knowledge graph"
          color="#f0f0f0" isLoading={scoresLoading} />
        <SummaryCard label="Hot Leads" value={counts.HOT} sub="score ≥ 70"
          color="#f97316" isLoading={scoresLoading} />
        <SummaryCard label="Warm Leads" value={counts.WARM} sub="score 40–69"
          color="#eab308" isLoading={scoresLoading} />
        <SummaryCard label="Cold Leads" value={counts.COLD} sub="score < 40"
          color="#60a5fa" isLoading={scoresLoading} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>

        {/* ── Top 5 Leads ── */}
        <div style={{
          backgroundColor: "#161b27",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "16px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>Top Leads</div>
            <Link to="/leads" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none" }}>
              View all →
            </Link>
          </div>

          {leadsLoading ? (
            <div style={{ padding: 22 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  height: 52, borderRadius: 8, marginBottom: 10,
                  backgroundColor: "rgba(255,255,255,0.04)",
                }} />
              ))}
            </div>
          ) : topLeads.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#777", fontSize: 13 }}>
              No leads yet. <Link to="/admin" style={{ color: "#6366f1", textDecoration: "underline" }}>Go to Admin</Link> to seed data.
            </div>
          ) : (
            <div style={{ padding: "8px 0" }}>
              {topLeads.map((company, i) => (
                <Link
                  key={company.id}
                  to="/leads"
                  style={{ textDecoration: "none" }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 22px",
                    borderBottom: i < topLeads.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "background 0.1s",
                    cursor: "pointer",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span style={{ fontSize: 13, color: "#777", fontWeight: 700, minWidth: 20 }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {company.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        {company.segment ?? "Unknown segment"} · {company.signals?.length ?? 0} signals
                      </div>
                    </div>
                    <TierBadge tier={company.tier} />
                    <ScoreBar score={company.score} tier={company.tier} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Graph Stats */}
          <div style={{
            backgroundColor: "#161b27",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 14 }}>Graph Stats</div>
            {[
              { label: "Companies",    value: stats?.companies    ?? "—" },
              { label: "Signals",      value: stats?.signals      ?? "—" },
              { label: "Applications", value: stats?.applications ?? "—" },
              { label: "Products",     value: stats?.products     ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                padding: "7px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: 13,
              }}>
                <span style={{ color: "#888" }}>{label}</span>
                <span style={{ color: "#ccc", fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 11, color: "#777", fontStyle: "italic" }}>
              → Go to <Link to="/admin" style={{ color: "#6366f1", textDecoration: "underline" }}>Admin</Link> for ingest and scoring controls
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
