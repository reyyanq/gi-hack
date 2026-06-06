import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = "http://localhost:3001/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TierLevel = "HOT" | "WARM" | "COLD";

export interface ScoreBreakdown {
  signal: number;      // 0-40
  productFit: number;  // 0-30
  segment: number;     // 0-20
  recency: number;     // 0-10
  total: number;       // 0-100
}

export interface Signal {
  type: string;
  date: string;
  confidence: number;
  description: string;
  url?: string;
}

export interface ScoredCompany {
  id: string;
  name: string;
  domain?: string;
  segment?: string;
  region?: string;
  score: number;
  tier: TierLevel;
  breakdown: ScoreBreakdown;
  outreachHook?: string;
  signals: Signal[];
  applications?: string[];
}

export interface SourceInfo {
  name: string;
  weight: number;
  status: "ok" | "error" | "idle";
  lastRun?: string;
  recordsFetched?: number;
}

export interface IngestResult {
  success: boolean;
  source?: string;
  recordsIngested: number;
  errors?: string[];
}

export interface GraphStats {
  companies: number;
  signals: number;
  applications: number;
  products: number;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const queryKeys = {
  scores: ["scores"] as const,
  sources: ["sources"] as const,
  graphStats: ["graphStats"] as const,
  health: ["health"] as const,
};

// ─── Fetch Helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Fetches all scored companies (HOT/WARM/COLD). */
export function useScores() {
  return useQuery({
    queryKey: queryKeys.scores,
    queryFn: () => fetchJson<ScoredCompany[]>("/graph/score"),
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
}

/** Returns the list of registered source adapters. */
export function useSources() {
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: () => fetchJson<SourceInfo[]>("/graph/ingest/sources"),
    staleTime: 1000 * 30,
  });
}

/** Checks the health status of the Neo4j graph. */
export function useGraphHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => fetchJson<{ status: string; message?: string }>("/graph/health"),
    refetchInterval: 1000 * 30,
  });
}

/** Retrieves Neo4j graph statistics. */
export function useGraphStats() {
  return useQuery({
    queryKey: queryKeys.graphStats,
    queryFn: () => fetchJson<GraphStats>("/graph/stats"),
    staleTime: 1000 * 60,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Loads the ontology and seed data into the graph. */
export function useSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ success: boolean; message: string }>("/graph/seed"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scores });
      qc.invalidateQueries({ queryKey: queryKeys.graphStats });
    },
  });
}

/** Runs ingestion for a specific source or for all sources. */
export function useIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source?: string) =>
      postJson<IngestResult>(`/graph/ingest${source ? `?source=${source}` : ""}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scores });
      qc.invalidateQueries({ queryKey: queryKeys.sources });
      qc.invalidateQueries({ queryKey: queryKeys.graphStats });
    },
  });
}

/** Recalculates scores for all companies. */
export function useRunScoring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ scored: number }>("/graph/score/run"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scores });
    },
  });
}

/** Runs an arbitrary Cypher query against the graph. */
export function useGraphQuery() {
  return useMutation({
    mutationFn: (cypher: string) =>
      postJson<{ results: unknown[] }>("/graph/query", { cypher }),
  });
}

/** Seeds sample data into the graph (graph explorer variant). */
export function useGraphSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ success: boolean; message: string }>("/graph/seed"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scores });
      qc.invalidateQueries({ queryKey: queryKeys.graphStats });
    },
  });
}

// ─── Derived Helpers ──────────────────────────────────────────────────────────

/** Counts companies by tier. */
export function useTierCounts() {
  const { data: companies = [], ...rest } = useScores();
  const counts = {
    HOT: companies.filter((c) => c.tier === "HOT").length,
    WARM: companies.filter((c) => c.tier === "WARM").length,
    COLD: companies.filter((c) => c.tier === "COLD").length,
    total: companies.length,
  };
  return { counts, ...rest };
}

/** Returns the top N companies ranked by score. */
export function useTopLeads(n = 5) {
  const { data: companies = [], ...rest } = useScores();
  const top = [...companies].sort((a, b) => b.score - a.score).slice(0, n);
  return { leads: top, ...rest };
}