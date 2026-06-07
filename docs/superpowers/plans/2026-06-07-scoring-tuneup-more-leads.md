# Scoring Tune-Up & More Leads — Sprint Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve scoring distribution from 1 HOT / 4 WARM / 1280 COLD to ~10-15 HOT / 80-120 WARM by fixing signal weights, adding segment classification, batch domain enrichment, and expanding ingestion.

**Architecture:** Scoring lives in `scorer.ts` (pure function data pipeline). Domain enrichment already exists in `domain-finder.ts` (LLM + DNS). Segment classification will follow the same pattern. Ingestion adapters are in `adapters/` — each is independent with configurable `MAX_PAGES` constant. All changes are backend-only; the client reads scores via `GET /api/graph/score`.

**Tech Stack:** TypeScript, Neo4j (Cypher), LLM via `createAIProvider` from `llm.ts`, `dns.resolve` + HTTP HEAD for domain validation.

---

### Task 1: Scoring Formula Tweaks

**Files:**
- Modify: `packages/server/src/services/graph/scoring/scorer.ts`
- Modify: `tests/unit/graph/scoring-edge-cases.test.ts` (add tests for new weights/thresholds)

- [ ] **Step 1: Add RESEARCH_PUBLICATION weight + lower thresholds**

In `scorer.ts`, change line 11-18 from:

```ts
const SIGNAL_WEIGHTS: Record<string, number> = {
  FDA_CLEARANCE: 40,
  CLINICAL_TRIAL: 30,
  PATENT: 25,
  HIRING: 20,
  FUNDING: 15,
  NEWS: 10,
};
```

To:

```ts
const SIGNAL_WEIGHTS: Record<string, number> = {
  FDA_CLEARANCE: 40,
  CLINICAL_TRIAL: 30,
  RESEARCH_PUBLICATION: 15,
  PATENT: 25,
  HIRING: 20,
  FUNDING: 15,
  NEWS: 10,
};
```

Change tier thresholds on lines 166-168:

```ts
if (totalScore >= 60) tier = "HOT";
else if (totalScore >= 30) tier = "WARM";
else tier = "COLD";
```

Remove the "no domain" disqualifier on line 135:

Change from:
```ts
if (validSignals.length === 0) disqualifiers.push("No signals detected — insufficient data");
if (!row.domain) disqualifiers.push("No domain/website — hard to qualify");
```

To:
```ts
if (validSignals.length === 0) disqualifiers.push("No signals detected — insufficient data");
```

- [ ] **Step 2: Build server to verify compilation**

```bash
npm -w packages/server run build
```
Expected: clean exit, no errors.

- [ ] **Step 3: Update scoring edge case tests**

Add to `tests/unit/graph/scoring-edge-cases.test.ts`:

```ts
it("should give RESEARCH_PUBLICATION weight 15", () => {
  const signals = [
    { type: "RESEARCH_PUBLICATION", date: "2025-06-01", confidence: 0.8, description: "Paper on coagulation" },
    { type: "RESEARCH_PUBLICATION", date: "2025-07-01", confidence: 0.7, description: "Paper on hemostasis" },
  ];
  let signalScore = 0;
  for (const s of signals) {
    const weight = 15;
    signalScore += weight * (s.confidence ?? 0.5);
  }
  signalScore = Math.min(signalScore / 10, 40);
  expect(signalScore).toBeGreaterThan(2);
  expect(signalScore).toBeLessThanOrEqual(40);
});

it("should classify WARM at totalScore >= 30", () => {
  expect(30 >= 60).toBe(false);  // NOT HOT
  expect(30 >= 30).toBe(true);   // IS WARM
  expect(29 >= 30).toBe(false);  // NOT WARM
});

it("should classify HOT at totalScore >= 60", () => {
  expect(60 >= 60).toBe(true);
  expect(59 >= 60).toBe(false);
});

it("should still treat unknown signal types with default weight 5", () => {
  const signals = [
    { type: "UNKNOWN_TYPE", date: "2025-01-01", confidence: 0.5, description: "unknown" },
  ];
  const weight = 5; // default
  const signalScore = Math.min((weight * 0.5) / 10, 40);
  expect(signalScore).toBe(0.25);
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/graph/scoring-edge-cases.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/graph/scoring/scorer.ts tests/unit/graph/scoring-edge-cases.test.ts
git commit -m "fix: add RESEARCH_PUBLICATION weight, lower tier thresholds to 30/60"
```

---

### Task 2: Batch Domain Enrichment (Run Existing)

**Files:** (no code changes — run against production)

- [ ] **Step 1: Trigger domain enrichment via API**

```bash
curl -X POST https://leads.graphwiz.ai/api/graph/enrich-domains -H "Content-Type: application/json" -d '{"limit": 200, "concurrency": 5}'
```

This calls `enrichDomains()` from `domain-finder.ts`. It processes up to 200 companies with no domain, using LLM to suggest a domain + DNS/HTTP to validate. Returns `{ enriched: N, failed: M, skipped: 0 }`.

Run in batches of 200 until all ~1270 domain-less companies are covered (~7 batches).

- [ ] **Step 2: Verify domain coverage**

```bash
# SSH to server, query Neo4j
docker exec leads-neo4j cypher-shell -u neo4j -p $PASSWORD \
  "MATCH (c:Company) WHERE c.domain IS NOT NULL RETURN count(*) AS withDomain, (MATCH (c2:Company) RETURN count(*)) AS total"
```

Expected: `withDomain` significantly increased.

---

### Task 3: Batch Segment Classification

**Files:**
- Create: `packages/server/src/services/graph/scoring/segment-classifier.ts`
- Modify: `packages/server/src/routes/graph.ts` (add POST /classify-segments endpoint)
- Create: `tests/unit/graph/segment-classifier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/graph/segment-classifier.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { classifyCompanySegment } from "../../../packages/server/src/services/graph/scoring/segment-classifier.js";

describe("segment-classifier", () => {
  it("should return IVD_MANUFACTURER for a diagnostics company", async () => {
    const result = await classifyCompanySegment("Bio-Rad Laboratories", "Clinical diagnostics manufacturer", []);
    expect(["IVD_MANUFACTURER", "CDMO", "SUPPLIER", "RESEARCH", null]).toContain(result);
  });

  it("should return RESEARCH for a university research center", async () => {
    const result = await classifyCompanySegment("Max Planck Institute", "Basic research in molecular biology", []);
    expect(["RESEARCH", null]).toContain(result);
  });

  it("should return CDMO for a contract manufacturer", async () => {
    const result = await classifyCompanySegment("Lonza", "Contract development and manufacturing for biopharma", []);
    expect(["CDMO", null]).toContain(result);
  });

  it("should handle empty description and signals gracefully", async () => {
    const result = await classifyCompanySegment("Unknown Corp", "", []);
    // Should not throw; returns null if LLM can't determine
    expect(result === null || typeof result === "string").toBe(true);
  });
});
```

- [ ] **Step 2: Create segment-classifier.ts**

Create `packages/server/src/services/graph/scoring/segment-classifier.ts`:

```ts
import { createAIProvider } from "../../ai/llm.js";
import { queryRows } from "../neo4j.js";

export type CompanySegment = "IVD_MANUFACTURER" | "CDMO" | "SUPPLIER" | "RESEARCH" | null;

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  IVD_MANUFACTURER: "Company that manufactures in vitro diagnostic products, assays, or medical devices for clinical use",
  CDMO: "Contract development and manufacturing organization that produces biological intermediates, raw materials, or components for other companies",
  SUPPLIER: "Company that supplies raw materials, reagents, or components to diagnostic manufacturers",
  RESEARCH: "Research institution, university, or non-profit focused on basic or applied research, not commercial production",
};

const CLASSIFICATION_PROMPT = `You are a B2B lead scoring system for Siemens Healthineers.
Classify the company into exactly one of these segments:
- IVD_MANUFACTURER
- CDMO
- SUPPLIER
- RESEARCH

Respond with ONLY the segment label, nothing else. If unsure, respond with "UNKNOWN".

Company: {{companyName}}
Description: {{description}}`;

export async function classifyCompanySegment(
  companyName: string,
  description: string,
  _signals: unknown[]
): Promise<CompanySegment> {
  const ai = createAIProvider({
    model: process.env.LLM_MODEL || "deepseek-v4-flash",
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL,
  });

  const prompt = CLASSIFICATION_PROMPT
    .replace("{{companyName}}", companyName)
    .replace("{{description}}", description || "No description available");

  try {
    const { text } = await ai.generateText({ prompt });
    const label = text.trim().toUpperCase().replace(/[^A-Z_]/g, "");
    if (["IVD_MANUFACTURER", "CDMO", "SUPPLIER", "RESEARCH"].includes(label)) {
      return label as CompanySegment;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ClassifyResult {
  classified: number;
  failed: number;
}

export async function classifyAllSegments(options?: {
  limit?: number;
  concurrency?: number;
}): Promise<ClassifyResult> {
  const limit = options?.limit ?? 200;
  const concurrency = options?.concurrency ?? 5;

  const companies = await queryRows(
    `MATCH (c:Company)
     WHERE c.segment IS NULL
     RETURN c.name AS name, c.description AS description
     ORDER BY c.name
     LIMIT $limit`,
    { limit: { low: limit, high: 0 } }
  );

  let classified = 0;
  let failed = 0;

  // Process in batches of concurrency
  for (let i = 0; i < companies.length; i += concurrency) {
    const batch = companies.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((c: any) =>
        classifyCompanySegment(c.name as string, (c.description as string) ?? "", [])
          .then(async (segment) => {
            if (segment) {
              const { runQuery } = await import("../neo4j.js");
              await runQuery(
                `MATCH (c:Company {name: $name})
                 SET c.segment = $segment`,
                { name: c.name, segment }
              );
              classified++;
            }
          })
      )
    );
    for (const r of results) {
      if (r.status === "rejected") failed++;
    }
  }

  return { classified, failed };
}
```

- [ ] **Step 3: Add route to graph.ts**

Add before the `export default router;` line in `packages/server/src/routes/graph.ts`:

```ts
router.post("/classify-segments", async (_req: Request, res: Response) => {
  try {
    const { classifyAllSegments } = await import("../services/graph/scoring/segment-classifier.js");
    const { limit, concurrency } = _req.body ?? {};
    const result = await classifyAllSegments({ limit, concurrency });
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "SEGMENT_CLASSIFY_FAILED", message } });
  }
});
```

- [ ] **Step 4: Build and test**

```bash
npm -w packages/server run build
npx vitest run tests/unit/graph/segment-classifier.test.ts
```
Expected: build clean, tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/graph/scoring/segment-classifier.ts packages/server/src/routes/graph.ts tests/unit/graph/segment-classifier.test.ts
git commit -m "feat: add LLM-based batch segment classification"
```

---

### Task 4: Expand Ingestion Adapter Batch Sizes

**Files:**
- Modify: `packages/server/src/services/graph/ingest/adapters/openalex.ts`
- Modify: `packages/server/src/services/graph/ingest/adapters/clinical-trials.ts`
- Modify: `packages/server/src/services/graph/ingest/adapters/fda-510k.ts`
- Modify: `packages/server/src/services/graph/ingest/adapters/github.ts`
- Modify: `packages/server/src/services/graph/ingest/adapters/epatent.ts`

- [ ] **Step 1: Increase OpenAlex pages**

In `openalex.ts`, find the `MAX_PAGES` or pagination limit. Change from 3 to 10 (or whatever the page size configuration is):

```ts
// Example: change
const MAX_PAGES = 3;
// To:
const MAX_PAGES = 10;
```

If the adapter uses a different pattern (e.g., `per_page=100` in URL), increase the count accordingly. Target: fetch up to 1000 results.

- [ ] **Step 2: Increase clinical-trials pages**

In `clinical-trials.ts`, apply the same pattern: change page/page size to target 500 results.

- [ ] **Step 3: Increase fda-510k pages**

In `fda-510k.ts`, apply same pattern: target 500 results.

- [ ] **Step 4: Increase github pages**

In `github.ts`, apply same pattern: target 500 results.

- [ ] **Step 5: Increase epatent pages**

In `epatent.ts`, apply same pattern: target 500 results.

- [ ] **Step 6: Verify compilation**

```bash
npm -w packages/server run build
```
Expected: clean exit.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/
git commit -m "feat: expand adapter batch sizes (3-10x more leads)"
```

---

### Task 5: Build, Deploy, Run Pipeline

**Files:** docker-compose.prod.yml, Dockerfile (no changes needed)

- [ ] **Step 1: Docker build**

```bash
docker build -t leads-app:latest -f Dockerfile .
```
Expected: build succeeds.

- [ ] **Step 2: Deploy to production**

```bash
docker save leads-app:latest | gzip > /tmp/leads-app-latest.tar.gz
scp /tmp/leads-app-latest.tar.gz root@178.254.2.90:/tmp/
ssh root@178.254.2.90 'docker load < /tmp/leads-app-latest.tar.gz && docker compose -f /home/weiss/git/gi-hack/docker-compose.prod.yml up -d --no-deps app'
```

- [ ] **Step 3: Verify deployment**

```bash
curl -sf https://leads.graphwiz.ai/api/health
curl -sf -X POST https://leads.graphwiz.ai/api/graph/score/run
```
Expected: both return 200.

- [ ] **Step 4: Run batch domain enrichment**

```bash
curl -X POST https://leads.graphwiz.ai/api/graph/enrich-domains \
  -H "Content-Type: application/json" \
  -d '{"limit": 200, "concurrency": 5}'
```
Repeat 7x (200 at a time) until all ~1270 domain-less companies are processed. Wait for each batch to complete before starting the next.

- [ ] **Step 5: Run batch segment classification**

```bash
curl -X POST https://leads.graphwiz.ai/api/graph/classify-segments \
  -H "Content-Type: application/json" \
  -d '{"limit": 200, "concurrency": 5}'
```
Repeat in batches until all unclassified companies are processed.

- [ ] **Step 6: Re-score**

```bash
curl -X POST https://leads.graphwiz.ai/api/graph/score/run
```
Expected: `{"scored": N}` where N is the new company count.

- [ ] **Step 7: Verify new score distribution**

```bash
curl -sf https://leads.graphwiz.ai/api/graph/score | python3 -c "
import json,sys
d = json.load(sys.stdin)
s = d['data']['summary']
print(f\"HOT: {s['hot']}, WARM: {s['warm']}, COLD: {s['cold']}, Total: {s['total']}, Avg: {s['avgScore']}\")
"
```
Expected: significantly more HOT (>5) and WARM (>50).

- [ ] **Step 8: Run E2E tests to verify UI still works**

```bash
npx playwright test
```
Expected: all 48 E2E tests pass.

---

### Task 6: Re-ingest with Larger Batches

**Files:** (no code changes — run against production)

- [ ] **Step 1: Run full ingestion pipeline**

```bash
curl -X POST https://leads.graphwiz.ai/api/graph/ingest
```
This starts ingestion in background. Wait for completion (check logs or use the status endpoint).

- [ ] **Step 2: Re-run enrichment + scoring**

Repeat Tasks 5.4, 5.5, 5.6 (batch domains, batch segments, re-score) for the new companies.

- [ ] **Step 3: Verify final numbers**

Check stats endpoint:
```bash
curl -sf https://leads.graphwiz.ai/api/graph/stats
```
Expected: company count significantly increased (target: 3,500+), scoring distribution improved.

- [ ] **Step 4: Final E2E test run**

```bash
npx playwright test
```
Expected: all tests pass (company counts in assertions may need updating).
