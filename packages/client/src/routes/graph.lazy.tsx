import { useState, useEffect, useRef } from "react";
import { useGraphQuery, useGraphSeed } from "../lib/graph";

interface GraphNode {
  id: string;
  label: string;
  labels: string[];
  color: string;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

const LABEL_CONFIG: Record<string, { color: string; size: number; label: string }> = {
  Company:    { color: "#6366f1", size: 28, label: "Company" },
  Signal:     { color: "#22c55e", size: 18, label: "Signal" },
  Contact:    { color: "#f97316", size: 24, label: "Contact" },
  PipelineStage: { color: "#eab308", size: 20, label: "Stage" },
  Activity:   { color: "#ec4899", size: 16, label: "Activity" },
  Product:    { color: "#a855f7", size: 22, label: "Product" },
  Application: { color: "#60a5fa", size: 20, label: "Application" },
};

const DEFAULT_LABEL_CONFIG = { color: "#64748b", size: 18, label: "Node" };

function getLabelConfig(labels: string[]) {
  for (const l of labels) {
    if (LABEL_CONFIG[l]) return LABEL_CONFIG[l];
  }
  return DEFAULT_LABEL_CONFIG;
}

export function GraphPage() {
  const PRESET_QUERIES = [
    { label: "Companies + Signals", query: "MATCH (c:Company)-[:HAS_SIGNAL]->(s:Signal) RETURN c, s LIMIT 30" },
    { label: "Companies + Products + Applications", query: "MATCH (c:Company)-[:SUPPLIES]->(p:Product), (c)-[:DEVELOPS]->(a:Application) RETURN c, p, a LIMIT 30" },
    { label: "Pipeline CRM", query: "MATCH (c:Company)<-[:CONTACT_AT]-(contact:Contact)-[:IN_STAGE]->(stage:PipelineStage) RETURN c, contact, stage LIMIT 30" },
    { label: "Contact Activity Trail", query: "MATCH (c:Company)<-[:CONTACT_AT]-(contact:Contact)-[:HAS_ACTIVITY]->(a:Activity) RETURN c, contact, a LIMIT 30" },
    { label: "Everything (slow)", query: "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 60" },
  ];

  const defaultQuery = PRESET_QUERIES[0].query;
  const [cypher, setCypher] = useState(defaultQuery);
  const [selectedPreset, setSelectedPreset] = useState(PRESET_QUERIES[0].label);
  const query = useGraphQuery();
  const seed = useGraphSeed();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const [iteration, setIteration] = useState(0);

  useEffect(() => {
    const raw = query.data as Record<string, unknown>;
    const responseData = raw?.data as Record<string, unknown> | undefined;
    if (!responseData?.records || !Array.isArray(responseData.records)) {
      setGraphData(null);
      return;
    }

    const records = responseData.records as Record<string, unknown>[];
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    for (const record of records) {
      for (const [, value] of Object.entries(record)) {
        if (typeof value !== "object" || value === null) continue;
        const obj = value as Record<string, unknown>;

        if (obj.labels && obj.identity != null) {
          const id = String(obj.identity);
          if (!nodes.has(id)) {
            const labels = (obj.labels as string[]) || [];
            const props = (obj.properties || {}) as Record<string, unknown>;
            const name = String(props.name || props.title || props.label || labels[0] || id);
            const cfg = getLabelConfig(labels);
            nodes.set(id, {
              id, label: name, labels,
              color: cfg.color, size: cfg.size,
              x: Math.random() * 700 + 50, y: Math.random() * 400 + 50, vx: 0, vy: 0,
            });
          }
        }

        if (obj.type && obj.start != null && obj.end != null) {
          edges.push({
            source: String(obj.start),
            target: String(obj.end),
            label: String(obj.type),
          });
        }
      }
    }

    setGraphData({ nodes: Array.from(nodes.values()), edges });
    setIteration(0);
  }, [query.data]);

  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;

    const nodes = graphData.nodes;
    const edges = graphData.edges;
    const width = containerRef.current?.clientWidth ?? 800;
    const height = 500;
    let running = true;
    let iter = 0;
    const maxIter = 300;

    const step = () => {
      if (!running || iter > maxIter) return;
      iter++;
      setIteration(iter);
      const alpha = Math.max(0.01, 1 - iter / maxIter);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (8000 * alpha) / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      for (const edge of edges) {
        const source = nodes.find((n) => n.id === edge.source);
        const target = nodes.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const spring = (dist - ((source.size + target.size) * 1.5)) * 0.02 * alpha;
        source.vx += (dx / dist) * spring;
        source.vy += (dy / dist) * spring;
        target.vx -= (dx / dist) * spring;
        target.vy -= (dy / dist) * spring;
      }

      for (const node of nodes) {
        node.vx += (width / 2 - node.x) * 0.002 * alpha;
        node.vy += (height / 2 - node.y) * 0.002 * alpha;
        node.vx *= 1 - 0.6 * alpha;
        node.vy *= 1 - 0.6 * alpha;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(node.size, Math.min(width - node.size, node.x));
        node.y = Math.max(node.size, Math.min(height - node.size, node.y));
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [graphData]);

  const nodeTypes = new Set<string>();
  if (graphData) {
    for (const node of graphData.nodes) {
      for (const l of node.labels) nodeTypes.add(l);
    }
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f0", margin: "0 0 4px" }}>Graph Explorer</h1>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 16px" }}>
        Write a Cypher query to explore the Neo4j knowledge graph. Use <code style={{ color: "#a5b4fc" }}>RETURN n, r, m</code> for visual rendering.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select
          value={selectedPreset}
          onChange={(e) => {
            const preset = PRESET_QUERIES.find(p => p.label === e.target.value);
            if (preset) {
              setCypher(preset.query);
              setSelectedPreset(preset.label);
            }
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            backgroundColor: "#161b27",
            color: "#ccc",
            fontSize: 12,
            cursor: "pointer",
            outline: "none",
            maxWidth: 180,
          }}
        >
          {PRESET_QUERIES.map((pq) => (
            <option key={pq.label} value={pq.label}>{pq.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={cypher}
          onChange={(e) => setCypher(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: "#161b27",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#ccc",
            outline: "none",
          }}
          placeholder="MATCH (c:Company)-[:HAS_SIGNAL]->(s:Signal) RETURN c, s LIMIT 30"
          onKeyDown={(e) => { if (e.key === "Enter") query.mutate(cypher); }}
        />
        <button
          onClick={() => query.mutate(cypher)}
          disabled={query.isPending}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.4)",
            backgroundColor: query.isPending ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.18)",
            color: query.isPending ? "#6b7280" : "#a5b4fc",
            fontSize: 13, fontWeight: 700,
            cursor: query.isPending ? "not-allowed" : "pointer",
          }}
        >
          {query.isPending ? "Running..." : "Run"}
        </button>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid rgba(34,197,94,0.3)",
            backgroundColor: seed.isPending ? "rgba(34,197,94,0.04)" : "rgba(34,197,94,0.08)",
            color: seed.isPending ? "#6b7280" : "#86efac",
            fontSize: 13, fontWeight: 600,
            cursor: seed.isPending ? "not-allowed" : "pointer",
          }}
        >
          {seed.isPending ? "Seeding..." : "Seed Data"}
        </button>
      </div>

      {query.isError && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 12,
          color: "#fca5a5", backgroundColor: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.15)", marginBottom: 16,
        }}>
          {(query.error as Error)?.message ?? "Query failed"}
        </div>
      )}

      {query.isSuccess && graphData && graphData.nodes.length > 0 && (
        <>
          <div ref={containerRef} style={{
            backgroundColor: "#0d1117",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            overflow: "hidden",
            position: "relative",
            marginBottom: 16,
          }}>
            <svg ref={svgRef} width="100%" height="500" style={{ display: "block", fontFamily: "system-ui, sans-serif" }} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.2)" />
                </marker>
              </defs>
              {graphData.edges.map((edge, i) => {
                const source = graphData.nodes.find((n) => n.id === edge.source);
                const target = graphData.nodes.find((n) => n.id === edge.target);
                if (!source || !target) return null;
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const offset = target.size + 4;
                const endX = target.x - (dx / dist) * offset;
                const endY = target.y - (dy / dist) * offset;
                const midX = (source.x + endX) / 2;
                const midY = (source.y + endY) / 2;
                return (
                  <g key={`edge-${i}`}>
                    <line
                      x1={source.x} y1={source.y}
                      x2={endX} y2={endY}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth={1}
                      markerEnd="url(#arrowhead)"
                    />
                    <text
                      x={midX} y={midY - 6}
                      fill="rgba(255,255,255,0.3)"
                      fontSize={7}
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              })}
              {graphData.nodes.map((node) => (
                <g key={node.id}>
                  <circle
                    cx={node.x} cy={node.y} r={node.size}
                    fill={node.color}
                    fillOpacity={0.2}
                    stroke={node.color}
                    strokeWidth={1.5}
                  />
                  <text
                    x={node.x} y={node.y + 4}
                    fill="#e0e0e0"
                    fontSize={node.size > 20 ? 10 : 8}
                    textAnchor="middle"
                    fontWeight={600}
                  >
                    {node.label.length > 14 ? node.label.slice(0, 14) + "…" : node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: "#666" }}>
              {graphData.nodes.length} nodes · {graphData.edges.length} edges
              {iteration > 0 && iteration < 300 && ` · layout ${Math.round((iteration / 300) * 100)}%`}
            </span>
            {Array.from(nodeTypes).map((type) => {
              const cfg = LABEL_CONFIG[type] ?? DEFAULT_LABEL_CONFIG;
              return (
                <span key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    backgroundColor: cfg.color, display: "inline-block",
                  }} />
                  <span style={{ fontSize: 11, color: "#888" }}>{cfg.label}</span>
                </span>
              );
            })}
          </div>
        </>
      )}

      {query.isSuccess && (!graphData || graphData.nodes.length === 0) && (
        <pre style={{
          backgroundColor: "#161b27",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, padding: 16,
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          color: "#888", overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap",
        }}>
          {JSON.stringify(query.data, null, 2)}
        </pre>
      )}

      {seed.isSuccess && (
        <div style={{
          marginTop: 16, padding: "10px 14px", borderRadius: 8, fontSize: 12,
          color: "#86efac", backgroundColor: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)",
        }}>
          ✓ Seed completed
        </div>
      )}
    </div>
  );
}
