import { runQuery } from "../neo4j.js";
import { SourceAdapter, SourceConfig, LeadCandidate, IngestionSummary } from "./types.js";

const LEGAL_SUFFIXES = [
  " gmbh", " ag", " co. kg", " gmbh & co. kg", " gmbh & co", " gmbh und co",
  " kg", " ltd", " ltd.", " limited", " inc", " inc.", " corporation", " corp",
  " llc", " llp", " plc", " pty ltd", " s.a.", " s.a.s", " s.r.l.",
  " group", " holdings", " holding", " gmbh & co. kg",
  "the binding site",
];

function stripLegalSuffix(name: string): string {
  let cleaned = name.toLowerCase().trim();
  for (const suffix of LEGAL_SUFFIXES) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trim();
    }
  }
  return cleaned;
}

function stripParenthetical(name: string): string {
  return name.replace(/\([^)]*\)/g, "").trim();
}

export function normalizeCompanyName(name: string): string {
  return stripLegalSuffix(stripParenthetical(name))
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Merge signals from multiple sources for the same company. De-duplicate by type+date+desc. */
function mergeSignals(candidates: LeadCandidate[]): LeadCandidate {
  const base = { ...candidates[0] };
  const seenSignals = new Set<string>();
  base.signals = [];
  for (const c of candidates) {
    for (const s of c.signals) {
      const key = `${s.type}::${s.date}::${s.description.slice(0, 80)}`;
      if (!seenSignals.has(key)) {
        seenSignals.add(key);
        base.signals.push(s);
      }
    }
  }
  return base;
}

async function upsertCompany(lead: LeadCandidate): Promise<void> {
  const normName = normalizeCompanyName(lead.companyName);

  // MERGE by normalized name, store original name as property
  await runQuery(
    `MERGE (c:Company {normalizedName: $normName})
     SET c.name = $name,
         c.domain = COALESCE(c.domain, $domain),
         c.description = COALESCE(c.description, $description)`,
    { normName, name: lead.companyName, domain: lead.domain ?? null, description: lead.description ?? null }
  );

  for (const area of lead.applicationAreas) {
    await runQuery(
      `MATCH (c:Company {normalizedName: $normName})
       OPTIONAL MATCH (a:Application {name: $area})
       WITH c, a WHERE a IS NOT NULL
       MERGE (c)-[:DEVELOPS]->(a)`,
      { normName, area }
    );
  }

  for (const signal of lead.signals) {
    // Dedup signal by type+date+company — create only once
    await runQuery(
      `MATCH (c:Company {normalizedName: $normName})
       MERGE (s:Signal {
         type: $type,
         date: $date,
         description: $description
       })
       ON CREATE SET s.confidence = $confidence, s.url = $url
       WITH c, s
       MERGE (c)-[:HAS_SIGNAL]->(s)`,
      {
        normName,
        type: signal.type,
        date: signal.date,
        description: signal.description,
        confidence: signal.confidence,
        url: signal.url ?? null,
      }
    );
  }
}

type AdapterEntry = {
  adapter: SourceAdapter;
  config: SourceConfig;
};

export class SourceManager {
  private pool: Map<string, AdapterEntry> = new Map();
  private maxConcurrency: number;

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  register(adapter: SourceAdapter, config?: Partial<SourceConfig>): void {
    this.pool.set(adapter.id, {
      adapter,
      config: {
        weight: config?.weight ?? 10,
        concurrency: config?.concurrency ?? 1,
        enabled: config?.enabled ?? true,
      },
    });
  }

  getRegistered(): string[] {
    return Array.from(this.pool.keys());
  }

  async getRegisteredHealth(): Promise<Array<{ id: string; healthy: boolean; error?: string }>> {
    const results: Array<{ id: string; healthy: boolean; error?: string }> = [];
    for (const [id, entry] of this.pool) {
      try {
        const healthy = await entry.adapter.healthCheck();
        results.push({ id, healthy });
      } catch (err) {
        results.push({ id, healthy: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  }

  /**
   * Fetch + normalize from a single adapter. Returns candidates instead of upserting,
   * so the caller can cross-source deduplicate first.
   */
  private async fetchAdapterCandidates(id: string): Promise<{
    candidates: LeadCandidate[];
    error?: string;
  }> {
    const entry = this.pool.get(id);
    if (!entry) {
      return { candidates: [], error: `No adapter "${id}"` };
    }
    const { adapter } = entry;
    try {
      const rawLeads = await adapter.fetch();
      return { candidates: rawLeads.map((r) => adapter.normalize(r)) };
    } catch (err) {
      return { candidates: [], error: `${id} fetch: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async runAll(onProgress?: (summary: IngestionSummary) => void): Promise<IngestionSummary[]> {
    const sorted = Array.from(this.pool.entries())
      .filter(([, e]) => e.config.enabled)
      .sort(([, a], [, b]) => b.config.weight - a.config.weight);

    // Phase 1: Fetch all adapters in parallel with concurrency pool
    type FetchResult = { sourceId: string; candidates: LeadCandidate[]; errors: string[] };
    const fetchResults: FetchResult[] = [];
    const running = new Set<Promise<void>>();

    for (const [id] of sorted) {
      while (running.size >= this.maxConcurrency) {
        await Promise.race(running);
      }
      const task = (async () => {
        const result = await this.fetchAdapterCandidates(id);
        const summary: IngestionSummary = {
          sourceId: id,
          fetched: result.candidates.length,
          created: 0,
          failed: result.error ? result.candidates.length : 0,
          errors: result.error ? [result.error] : [],
        };
        fetchResults.push({
          sourceId: id,
          candidates: result.candidates,
          errors: result.error ? [result.error] : [],
        });
        if (onProgress) onProgress(summary);
      })();
      running.add(task);
      task.finally(() => running.delete(task));
    }
    await Promise.allSettled(running);

    // Phase 2: Cross-source deduplication — group candidates by normalized name
    const groups = new Map<string, LeadCandidate[]>();
    for (const fr of fetchResults) {
      for (const c of fr.candidates) {
        const key = normalizeCompanyName(c.companyName);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(c);
      }
    }

    // Phase 3: Merge signals for same-company groups, then upsert
    // Build reverse mapping from candidate sourceId → adapter sourceId
    const candidateToAdapter = new Map<string, string>();
    for (const fr of fetchResults) {
      for (const c of fr.candidates) {
        candidateToAdapter.set(c.sourceId, fr.sourceId);
      }
    }

    const summaries = new Map<string, IngestionSummary>();
    for (const fr of fetchResults) {
      summaries.set(fr.sourceId, {
        sourceId: fr.sourceId,
        fetched: fr.candidates.length,
        created: 0,
        failed: 0,
        errors: fr.errors,
      });
    }

    for (const [, group] of groups) {
      const merged = mergeSignals(group);
      // Upsert using the best/preferred company name (longest, most descriptive)
      const bestName = group.sort((a, b) => b.companyName.length - a.companyName.length)[0];
      merged.companyName = bestName.companyName;
      merged.domain = bestName.domain ?? merged.domain;

      // Track which adapters contributed to this company (map candidate ID → adapter ID)
      const adapterIds = [...new Set(group.map((c) => candidateToAdapter.get(c.sourceId) ?? c.sourceId))];

      try {
        await upsertCompany(merged);
        for (const aid of adapterIds) {
          const s = summaries.get(aid);
          if (s) s.created++;
        }
      } catch (err) {
        const msg = `Upsert fail ${merged.companyName}: ${err instanceof Error ? err.message : String(err)}`;
        for (const aid of adapterIds) {
          const s = summaries.get(aid);
          if (s) {
            s.failed++;
            s.errors.push(msg);
          }
        }
      }
    }

    return Array.from(summaries.values());
  }

  async runSingle(sourceId: string): Promise<IngestionSummary> {
    const result = await this.fetchAdapterCandidates(sourceId);
    const summary: IngestionSummary = {
      sourceId,
      fetched: result.candidates.length,
      created: 0,
      failed: 0,
      errors: result.error ? [result.error] : [],
    };

    // Group by normalized name (same logic as runAll for consistency)
    const groups = new Map<string, LeadCandidate[]>();
    for (const c of result.candidates) {
      const key = normalizeCompanyName(c.companyName);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    for (const [, group] of groups) {
      const merged = mergeSignals(group);
      const bestName = group.sort((a, b) => b.companyName.length - a.companyName.length)[0];
      merged.companyName = bestName.companyName;
      merged.domain = bestName.domain ?? merged.domain;

      try {
        await upsertCompany(merged);
        summary.created++;
      } catch (err) {
        summary.failed++;
        summary.errors.push(`Upsert fail ${merged.companyName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return summary;
  }
}
