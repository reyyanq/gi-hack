import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useScores, type ScoredCompany, type TierLevel } from "../lib/graph";

// @ts-ignore - TanStack Router type definition issue
export const Route = createFileRoute("/leads")({
  component: LeadsPage,
});

// ─── Tier config ──────────────────────────────────────────────────────────────

const tierConfig: Record<TierLevel, { color: string; bg: string; border: string }> = {
  HOT:  { color: "#f97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.3)" },
  WARM: { color: "#eab308", bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.3)" },
  COLD: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)" },
};

// ─── Small components ─────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: TierLevel }) {
  const c = tierConfig[tier];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
      color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}`,
      letterSpacing: "0.5px",
    }}>
      {tier === "HOT" ? "🔥" : tier === "WARM" ? "⭐" : "❄️"} {tier}
    </span>
  );
}

function ScoreBar({ score, tier }: { score: number; tier: TierLevel }) {
  const color = tierConfig[tier].color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 80, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ width: `${score}%`, height: "100%", borderRadius: 3, backgroundColor: color }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 700, minWidth: 26 }}>{score}</span>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ company, onClose }: { company: ScoredCompany; onClose: () => void }) {
  const c = tierConfig[company.tier];
  const bd = company.breakdown;

  const breakdownItems = [
    { label: "Signal Score",   value: bd?.signal ?? 0,     max: 40 },
    { label: "Product Fit",    value: bd?.productFit ?? 0, max: 30 },
    { label: "Segment Bonus",  value: bd?.segment ?? 0,    max: 20 },
    { label: "Recency Bonus",  value: bd?.recency ?? 0,    max: 10 },
  ];

  const sortedSignals = [...(company.signals ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 40, backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
        backgroundColor: "#161b27",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        zIndex: 50, overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          position: "sticky", top: 0, backgroundColor: "#161b27", zIndex: 1,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>{company.name}</h2>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                {company.domain ?? "—"} · {company.segment ?? "Unknown"} · {company.region ?? "—"}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)", border: "none", color: "#888",
                cursor: "pointer", borderRadius: 8, width: 32, height: 32,
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <TierBadge tier={company.tier} />
            <ScoreBar score={company.score} tier={company.tier} />
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Score Breakdown */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Score Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {breakdownItems.map(({ label, value, max }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "#888" }}>{label}</span>
                    <span style={{ color: "#ccc", fontWeight: 600 }}>{value} / {max}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <div style={{
                      width: `${(value / max) * 100}%`, height: "100%", borderRadius: 3,
                      backgroundColor: c.color, opacity: 0.85,
                    }} />
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: 6, padding: "10px 14px", borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.04)",
                display: "flex", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>Total Score</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{company.score} / 100</span>
              </div>
            </div>
          </section>

          {/* Outreach Hook */}
          {company.outreachHook && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>
                Outreach Hook
              </div>
              <div style={{
                padding: "12px 14px", borderRadius: 10,
                backgroundColor: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                fontSize: 13, color: "#c7d2fe", lineHeight: 1.6,
                fontStyle: "italic",
              }}>
                "{company.outreachHook}"
              </div>
            </section>
          )}

          {/* Signals Timeline */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Signals Timeline ({sortedSignals.length})
            </div>

            {sortedSignals.length === 0 ? (
              <div style={{ fontSize: 13, color: "#777", padding: "12px 0" }}>No signals found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {sortedSignals.map((signal, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, paddingBottom: 16, position: "relative" }}>
                    {/* Timeline line */}
                    {i < sortedSignals.length - 1 && (
                      <div style={{
                        position: "absolute", left: 7, top: 16, bottom: 0, width: 1,
                        backgroundColor: "rgba(255,255,255,0.07)",
                      }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 15, height: 15, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                      backgroundColor: `rgba(99,102,241,${0.4 + signal.confidence * 0.6})`,
                      border: "2px solid rgba(99,102,241,0.4)",
                      zIndex: 1,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>{signal.type}</span>
                        <span style={{ fontSize: 11, color: "#777", flexShrink: 0 }}>
                          {signal.date ? new Date(signal.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#999", margin: "4px 0 0", lineHeight: 1.5 }}>
                        {signal.description}
                      </p>
                      {signal.url && (
                        <a
                          href={signal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#6366f1", textDecoration: "none", marginTop: 4, display: "inline-block" }}
                        >
                          View source →
                        </a>
                      )}
                      {/* Confidence */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "#777" }}>Confidence</span>
                        <div style={{ width: 50, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)" }}>
                          <div style={{ width: `${signal.confidence * 100}%`, height: "100%", borderRadius: 2, backgroundColor: "#6366f1" }} />
                        </div>
                        <span style={{ fontSize: 10, color: "#555" }}>{Math.round(signal.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Applications */}
          {company.applications && company.applications.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>
                Applications
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {company.applications.map((app) => (
                  <span key={app} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#aaa",
                  }}>
                    {app}
                  </span>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ALL_TIERS: TierLevel[] = ["HOT", "WARM", "COLD"];
const SEGMENTS = ["IVD", "CDMO", "Supplier", "Research", "Pharma", "Other"];

export function LeadsPage() {
  const { data: companies = [], isLoading } = useScores();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierLevel | "ALL">("ALL");
  const [segmentFilter, setSegmentFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<ScoredCompany | null>(null);

  const filtered = useMemo(() => {
    return companies
      .filter((c) => {
        if (tierFilter !== "ALL" && c.tier !== tierFilter) return false;
        if (segmentFilter !== "ALL" && c.segment !== segmentFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.domain?.toLowerCase().includes(q) ||
            c.segment?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [companies, search, tierFilter, segmentFilter]);

  const presentSegments = useMemo(() => {
    const set = new Set(companies.map((c) => c.segment).filter(Boolean) as string[]);
    return SEGMENTS.filter((s) => set.has(s));
  }, [companies]);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", margin: 0 }}>Lead Explorer</h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          {filtered.length} companies · sorted by score
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px 9px 36px",
              backgroundColor: "#161b27", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#e0e0e0", fontSize: 13,
              outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#444", fontSize: 14 }}>🔍</span>
        </div>

        {/* Tier filter */}
        {(["ALL", ...ALL_TIERS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px solid",
              cursor: "pointer",
              ...(tierFilter === t
                ? t === "ALL"
                  ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }
                  : { backgroundColor: tierConfig[t].bg, color: tierConfig[t].color, borderColor: tierConfig[t].border }
                  : { backgroundColor: "transparent", color: "#888", borderColor: "rgba(255,255,255,0.08)" }
              ),
            }}
          >
            {t === "HOT" ? "🔥 " : t === "WARM" ? "⭐ " : t === "COLD" ? "❄️ " : ""}{t}
          </button>
        ))}

        {/* Segment filter */}
        {presentSegments.length > 0 && (
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 12,
              backgroundColor: "#161b27", border: "1px solid rgba(255,255,255,0.1)",
              color: "#aaa", cursor: "pointer", outline: "none",
            }}
          >
            <option value="ALL">All segments</option>
            {presentSegments.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: "#161b27",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
      }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 100px 100px 140px 180px",
          padding: "10px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11, fontWeight: 700, color: "#777",
          letterSpacing: "0.6px", textTransform: "uppercase",
        }}>
          <span>Company</span>
          <span>Tier</span>
          <span>Score</span>
          <span>Segment</span>
          <span>Signals</span>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div style={{ padding: 24 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ height: 52, borderRadius: 8, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#777", fontSize: 14 }}>
            No leads match your filters.
          </div>
        ) : (
          filtered.map((company, i) => (
            <div
              key={company.id}
              onClick={() => setSelected(company)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 100px 100px 140px 180px",
                padding: "14px 20px",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                cursor: "pointer",
                transition: "background 0.1s",
                alignItems: "center",
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {/* Company name */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{company.name}</div>
                <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{company.domain ?? "—"}</div>
              </div>

              {/* Tier */}
              <TierBadge tier={company.tier} />

              {/* Score bar */}
              <ScoreBar score={company.score} tier={company.tier} />

              {/* Segment */}
              <span style={{ fontSize: 12, color: "#888" }}>{company.segment ?? "—"}</span>

              {/* Signal types */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {[...new Set(company.signals?.map((s) => s.type) ?? [])].slice(0, 3).map((type) => (
                  <span key={type} style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 10,
                    backgroundColor: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    color: "#818cf8",
                  }}>
                    {type}
                  </span>
                ))}
                {(company.signals?.length ?? 0) > 3 && (
                  <span style={{ fontSize: 10, color: "#777" }}>+{company.signals.length - 3}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Drawer */}
      {selected && <DetailDrawer company={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
