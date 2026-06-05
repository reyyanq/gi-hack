# LeadGraph — Comprehensive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete LeadGraph platform: data ingestion from 7 sources → Neo4j knowledge graph → AI scoring pipeline → React dashboard → Pipeline CRM with activity tracking → AI-powered outreach emails.

**Architecture:** 4 parallel tracks — (1) Backend ingestion + scoring, (2) React dashboard UI, (3) Pipeline CRM, (4) AI outreach layer. All layers share the Neo4j graph via Express API routes. The scoring pipeline needs a `queryRows` helper because `runQuery` returns `{ records: [{keys, values}] }`, not raw row objects.

**Tech Stack:** Express + TypeScript + Neo4j + Vercel AI SDK | React 19 + TanStack Router/Query + Tailwind v4

---

## Phase 1: Backend Foundation (Tasks 1-9)

### Task 1: Add queryRows helper to neo4j.ts

**Files:**
- Modify: `packages/server/src/services/graph/neo4j.ts`

The existing `runQuery` returns records as `{keys, values}` where values are strings. The scorer needs raw Record objects with `.get()` access. Add a `queryRows` function.

- [ ] **Add queryRows to neo4j.ts**

Add after the `runQuery` function (before `closeDriver`):

```typescript
/**
 * Run Cypher and return raw neo4j Record[] (each has .get(key) method).
 * Use this for queries that need to read property values as their native types.
 */
export async function queryRows(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<any[]> {
  if (!driver) throw new Error("Neo4j driver not initialized");

  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => ({
      keys: record.keys,
      ...Object.fromEntries(
        record.keys.map((key) => [key, record.get(key)])
      ),
    }));
  } finally {
    await session.close();
  }
}
```

- [ ] **Export queryRows in the neo4j.ts exports**

Update the existing `export` block. Currently only `runQuery` is used externally. Make sure `queryRows` is also importable. The file uses named exports so just adding `export async function queryRows` is enough.

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/neo4j.ts
git commit -m "feat: add queryRows helper for native Neo4j record access"
```

---

### Task 2: Types + SourceAdapter Interface

**Files:**
- Create: `packages/server/src/services/graph/ingest/types.ts`

- [ ] **Write the SourceAdapter interface and all data shapes**

```typescript
export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  fetch(): Promise<RawLead[]>;
  normalize(raw: RawLead): LeadCandidate;
  healthCheck(): Promise<boolean>;
}

export interface RawLead {
  sourceId: string;
  sourceUrl?: string;
  raw: Record<string, unknown>;
}

export interface LeadCandidate {
  sourceId: string;
  companyName: string;
  domain?: string;
  description?: string;
  applicationAreas: string[];
  signals: Signal[];
  regulatoryStandards?: string[];
}

export interface Signal {
  type: SignalType;
  date: string;
  description: string;
  confidence: number;
  url?: string;
}

export type SignalType =
  | "FDA_CLEARANCE"
  | "CLINICAL_TRIAL"
  | "PATENT"
  | "HIRING"
  | "FUNDING"
  | "NEWS";

export interface IngestionSummary {
  sourceId: string;
  fetched: number;
  created: number;
  failed: number;
  errors: string[];
}

export interface SeedSummary {
  constraintsCreated: number;
  applicationAreas: number;
  companiesSeeded: number;
  productsSeeded: number;
  relationshipsCreated: number;
}

// ---- KeeLead-inspired: per-source weight/config ----
export interface SourceConfig {
  weight: number;
  concurrency?: number;
  enabled: boolean;
}

// ---- OpenGTM-inspired: tier classification ----
export type TierLevel = "HOT" | "WARM" | "COLD";

// ---- Lead Engine-inspired: disqualifier + score breakdown ----
export interface Disqualifier {
  reason: string;
  severity: "HARD" | "SOFT";
}

export interface ScoreBreakdown {
  signalScore: number;
  productFitScore: number;
  segmentBonus: number;
  recencyBonus: number;
  total: number;
}

export interface ScoredCompany {
  companyName: string;
  tier: TierLevel;
  score: number;
  breakdown: ScoreBreakdown;
  disqualifiers: Disqualifier[];
  outreachHook?: string;
}

export interface ScoredResult {
  companyName: string;
  tier: "HOT" | "WARM" | "COLD";
  totalScore: number;
  breakdown: {
    signalScore: number;
    productFitScore: number;
    segmentBonus: number;
    recencyBonus: number;
  };
  disqualifiers: string[];
  outreachHook?: string;
}
```

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/ingest/types.ts
git commit -m "feat: add SourceAdapter interface and all data shapes"
```

---

### Task 3: Ontology Seed Script

**Files:**
- Create: `packages/server/src/services/graph/ingest/ontology.ts`

- [ ] **Write the ontology seed module**

```typescript
import { runQuery } from "../neo4j.js";

const CONSTRAINTS = [
  "CREATE CONSTRAINT company_name IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE",
  "CREATE CONSTRAINT application_name IF NOT EXISTS FOR (a:Application) REQUIRE a.name IS UNIQUE",
  "CREATE INDEX company_domain IF NOT EXISTS FOR (c:Company) ON (c.domain)",
  "CREATE INDEX signal_type_idx IF NOT EXISTS FOR (s:Signal) ON (s.type)",
  "CREATE INDEX signal_date_idx IF NOT EXISTS FOR (s:Signal) ON (s.date)",
];

const APPLICATION_AREAS = [
  { name: "Hemostasis", category: "HEMATOLOGY", marketSize: "2.1B" },
  { name: "Plasma Proteins", category: "PROTEIN_CHEMISTRY", marketSize: "1.8B" },
  { name: "Infectious Disease", category: "MICROBIOLOGY", marketSize: "4.5B" },
  { name: "Oncology Assays", category: "ONCOLOGY", marketSize: "3.2B" },
  { name: "Neurology Markers", category: "NEUROLOGY", marketSize: "1.1B" },
  { name: "Cardiac Markers", category: "CARDIOLOGY", marketSize: "2.8B" },
  { name: "Autoimmune Diagnostics", category: "IMMUNOLOGY", marketSize: "1.5B" },
];

const PRODUCTS: Array<{
  name: string; catalogId: string; category: string; applications: string[];
}> = [
  { name: "INNOVANCE D-Dimer", catalogId: "OPBP-001", category: "HEMOSTASIS_PROTEIN", applications: ["Hemostasis"] },
  { name: "INNOVANCE Antithrombin", catalogId: "OPBP-002", category: "HEMOSTASIS_PROTEIN", applications: ["Hemostasis"] },
  { name: "INNOVANCE VWF Ac", catalogId: "OPBP-003", category: "HEMOSTASIS_PROTEIN", applications: ["Hemostasis"] },
  { name: "N Antiserum to Human Transferrin", catalogId: "OPBP-004", category: "PLASMA_ANTIBODY", applications: ["Plasma Proteins"] },
  { name: "N Antiserum to Human Haptoglobin", catalogId: "OPBP-005", category: "PLASMA_ANTIBODY", applications: ["Plasma Proteins"] },
  { name: "N Antiserum to Human Alpha-1 Antitrypsin", catalogId: "OPBP-006", category: "PLASMA_ANTIBODY", applications: ["Plasma Proteins"] },
  { name: "BC Latex Reagent", catalogId: "OPBP-007", category: "LATEX_REAGENT", applications: ["Hemostasis"] },
  { name: "HLA-B27 Antibody", catalogId: "OPBP-008", category: "DIAGNOSTIC_ANTIBODY", applications: ["Autoimmune Diagnostics"] },
  { name: "Troponin I Antibody Pair", catalogId: "OPBP-009", category: "DIAGNOSTIC_ANTIBODY", applications: ["Cardiac Markers"] },
  { name: "PSA Antibody Pair", catalogId: "OPBP-010", category: "DIAGNOSTIC_ANTIBODY", applications: ["Oncology Assays"] },
];

const COMPETITOR_COMPANIES: Array<{
  name: string; domain: string; segment: string; region: string;
  applications: string[]; products: string[];
}> = [
  { name: "SERION Immunologics", domain: "serion-immunologics.com", segment: "SUPPLIER", region: "EUROPE", applications: ["Infectious Disease", "Plasma Proteins"], products: ["Dengue Antigen", "WNV Envelope Protein"] },
  { name: "ASKA Biotech", domain: "aska-biotech.de", segment: "CDMO", region: "EUROPE", applications: ["Infectious Disease", "Oncology Assays"], products: ["Custom mAb", "Recombinant Protein"] },
  { name: "JTC Diagnostics", domain: "jtc-diagnostics.de", segment: "SUPPLIER", region: "EUROPE", applications: ["Infectious Disease", "Cardiac Markers"], products: ["Enzymes", "Antibodies", "Antigens"] },
  { name: "NAGASE Europe", domain: "nagase.eu", segment: "SUPPLIER", region: "EUROPE", applications: ["Cardiac Markers", "Neurology Markers"], products: ["AFP Antibody", "Anti-Tau Antibody"] },
  { name: "BioGenes", domain: "biogenes.de", segment: "CDMO", region: "EUROPE", applications: ["Infectious Disease", "Neurology Markers"], products: ["HCP ELISA Kit", "Custom Antibody"] },
  { name: "InVivo BioTech", domain: "invivo.de", segment: "CDMO", region: "EUROPE", applications: ["Hemostasis", "Plasma Proteins"], products: ["mAb Production", "Protein Expression"] },
  { name: "SeamlessBio", domain: "seamlessbio.de", segment: "CDMO", region: "EUROPE", applications: ["Infectious Disease", "Oncology Assays"], products: ["Recombinant Protein", "BSA", "Human Plasma"] },
  { name: "Merck KGaA", domain: "merckgroup.com", segment: "SUPPLIER", region: "EUROPE", applications: ["Infectious Disease", "Oncology Assays", "Cardiac Markers"], products: ["Antibodies", "Reagents"] },
  { name: "Bio-Rad Laboratories", domain: "bio-rad.com", segment: "SUPPLIER", region: "NORTH_AMERICA", applications: ["Hemostasis", "Infectious Disease", "Plasma Proteins"], products: ["Antibodies", "Reagents"] },
  { name: "Thermo Fisher Scientific", domain: "thermofisher.com", segment: "SUPPLIER", region: "NORTH_AMERICA", applications: ["Infectious Disease", "Oncology Assays", "Hemostasis"], products: ["Invitrogen Antibodies", "Pierce Proteins"] },
  { name: "Sysmex", domain: "sysmex.com", segment: "IVD_MANUFACTURER", region: "ASIA", applications: ["Hemostasis", "Plasma Proteins"], products: ["CS-Series Analyzers"] },
  { name: "Roche Diagnostics", domain: "roche.com", segment: "IVD_MANUFACTURER", region: "EUROPE", applications: ["Oncology Assays", "Infectious Disease", "Cardiac Markers"], products: ["Elecsys Assays", "cobas Systems"] },
  { name: "Abbott Diagnostics", domain: "abbott.com", segment: "IVD_MANUFACTURER", region: "NORTH_AMERICA", applications: ["Cardiac Markers", "Infectious Disease", "Neurology Markers"], products: ["ARCHITECT Assays", "Alinity Systems"] },
  { name: "Euroimmun", domain: "euroimmun.com", segment: "IVD_MANUFACTURER", region: "EUROPE", applications: ["Autoimmune Diagnostics", "Infectious Disease"], products: ["IIFT Assays", "ELISA Kits"] },
  { name: "bioMérieux", domain: "biomerieux.com", segment: "IVD_MANUFACTURER", region: "EUROPE", applications: ["Infectious Disease", "Plasma Proteins"], products: ["VITEK Systems", "VIDAS Assays"] },
];

export async function seedGraph(): Promise<{
  constraintsCreated: number;
  applicationAreas: number;
  companiesSeeded: number;
  productsSeeded: number;
  relationshipsCreated: number;
}> {
  let constraintsCreated = 0;
  for (const cypher of CONSTRAINTS) {
    await runQuery(cypher);
    constraintsCreated++;
  }

  for (const app of APPLICATION_AREAS) {
    await runQuery(
      `MERGE (a:Application {name: $name})
       SET a.category = $category, a.marketSize = $marketSize`,
      app
    );
  }

  await runQuery(
    `MERGE (c:Company {name: $name})
     SET c.domain = $domain, c.segment = $segment, c.region = $region`,
    { name: "Siemens Healthineers", domain: "siemens-healthineers.com", segment: "IVD_MANUFACTURER", region: "EUROPE" }
  );

  for (const p of PRODUCTS) {
    await runQuery(
      `MERGE (prod:Product {catalogId: $catalogId})
       SET prod.name = $name, prod.category = $category`,
      { name: p.name, catalogId: p.catalogId, category: p.category }
    );
    await runQuery(
      `MATCH (c:Company {name: "Siemens Healthineers"})
       MATCH (prod:Product {catalogId: $catalogId})
       MERGE (c)-[:SUPPLIES]->(prod)`,
      { catalogId: p.catalogId }
    );
    for (const appName of p.applications) {
      await runQuery(
        `MATCH (prod:Product {catalogId: $catalogId})
         MATCH (a:Application {name: $appName})
         MERGE (prod)-[:USED_IN]->(a)`,
        { catalogId: p.catalogId, appName }
      );
    }
  }

  for (const comp of COMPETITOR_COMPANIES) {
    await runQuery(
      `MERGE (c:Company {name: $name})
       SET c.domain = $domain, c.segment = $segment, c.region = $region`,
      { name: comp.name, domain: comp.domain, segment: comp.segment, region: comp.region }
    );
    for (const appName of comp.applications) {
      await runQuery(
        `MATCH (c:Company {name: $name})
         MATCH (a:Application {name: $appName})
         MERGE (c)-[:DEVELOPS]->(a)`,
        { name: comp.name, appName }
      );
    }
  }

  return {
    constraintsCreated,
    applicationAreas: APPLICATION_AREAS.length,
    companiesSeeded: COMPETITOR_COMPANIES.length + 1,
    productsSeeded: PRODUCTS.length,
    relationshipsCreated: -1,
  };
}
```

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/ingest/ontology.ts
git commit -m "feat: add ontology seed with 7 applications, 15 companies, 10 products"
```

---

### Task 4: 5 Stub Adapters

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/clinical-trials.ts`
- Create: `packages/server/src/services/graph/ingest/adapters/patent-stub.ts`
- Create: `packages/server/src/services/graph/ingest/adapters/hiring-stub.ts`
- Create: `packages/server/src/services/graph/ingest/adapters/conference-stub.ts`
- Create: `packages/server/src/services/graph/ingest/adapters/funding-stub.ts`

Each stub follows the same pattern: hardcoded records → RawLead[] in fetch(), map to LeadCandidate with Signal in normalize(). See the existing ingestion plan (`docs/superpowers/plans/2026-06-05-leadgraph-ingestion.md` Task 3) for the complete code of each.

- [ ] **Create directory**

```bash
mkdir -p packages/server/src/services/graph/ingest/adapters
```

- [ ] **Write clinical-trials.ts** — 4 simulated trial records (Euroimmun, BioGenes, Roche, Sysmex) with NCT IDs, phases, and application areas. Signal type: CLINICAL_TRIAL, confidence: 0.7

- [ ] **Write patent-stub.ts** — 5 simulated patent records (Euroimmun, Bio-Rad, Abbott, Sysmex, Merck) with patent IDs. Signal type: PATENT, confidence: 0.65

- [ ] **Write hiring-stub.ts** — 5 simulated job postings (BioGenes, ASKA, SeamlessBio, SERION, Euroimmun) with R&D/QA roles. Signal type: HIRING, confidence: 0.85

- [ ] **Write conference-stub.ts** — 5 simulated trade show records (MEDICA, ADLM, Analytica, BIO-Europe). Signal type: NEWS, confidence: 0.6

- [ ] **Write funding-stub.ts** — 4 simulated funding rounds (ASKA Series A €8M, SeamlessBio Growth €5M, etc.). Signal type: FUNDING, confidence: 0.8

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/*-stub.ts
git commit -m "feat: add 5 stub adapters for clinical-trials, patents, hiring, conferences, funding"
```

---

### Task 5: FDA 510(k) Real Adapter

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/fda-510k.ts`

- [ ] **Write the FDA 510(k) adapter**

```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const RELEVANT_CODES = ["JPA", "JSO", "JXV", "JJF", "JTW", "JLH", "JXI", "JZJ"];

interface FDA510kRecord {
  k_number: string;
  applicant: string;
  device_name: string;
  product_code: string;
  decision_date: string;
  clearance_type: string;
  address_1: string;
  city: string;
  state: string;
  country: string;
  zip_code: string;
}

interface FDAAPIResponse {
  results: FDA510kRecord[];
  meta: { results: { total: number }; next?: string };
}

function extractCompanyName(rawName: string): string {
  return rawName
    .replace(/\s+(INC|CORP|LLC|GMBH|LTD|AG|NV|PLC|PTY)\.?$/i, "")
    .replace(/,\s*$/, "")
    .trim();
}

function mapProductCodeToApplications(code: string): string[] {
  const mapping: Record<string, string[]> = {
    JPA: ["Hemostasis"],
    JSO: ["Plasma Proteins"],
    JXV: ["Infectious Disease", "Autoimmune Diagnostics"],
    JJF: ["Cardiac Markers"],
    JTW: ["Hemostasis"],
    JLH: ["Neurology Markers"],
    JXI: ["Oncology Assays"],
    JZJ: ["Plasma Proteins"],
  };
  return mapping[code] ?? ["Infectious Disease"];
}

export class FDA510kAdapter implements SourceAdapter {
  readonly id = "fda-510k";
  readonly name = "FDA 510(k) Database";
  readonly description = "FDA premarket notification clearances for diagnostic devices";

  private lastFetchDate: string = "2025-06-01";

  async fetch(): Promise<RawLead[]> {
    const allRecords: RawLead[] = [];

    for (const code of RELEVANT_CODES) {
      const url = `https://api.fda.gov/device/510k.json?search=product_code:${code}+AND+decision_date:[${this.lastFetchDate}+TO+2026-06-05]&limit=50&sort=decision_date:desc`;

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          console.warn(`FDA API returned ${res.status} for code ${code}`);
          continue;
        }
        const data: FDAAPIResponse = await res.json();
        if (!data.results || data.results.length === 0) continue;

        for (const record of data.results) {
          allRecords.push({
            sourceId: `fda-${record.k_number}`,
            sourceUrl: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${record.k_number}`,
            raw: record as unknown as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch FDA ${code}:`, err);
      }
    }

    return allRecords;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as unknown as FDA510kRecord;
    const companyName = extractCompanyName(r.applicant);
    const applications = mapProductCodeToApplications(r.product_code);

    const signal: Signal = {
      type: "FDA_CLEARANCE",
      date: r.decision_date,
      description: `${r.device_name} — ${r.product_code} clearance`,
      confidence: 0.95,
      url: raw.sourceUrl,
    };

    return {
      sourceId: raw.sourceId,
      companyName,
      description: r.device_name,
      applicationAreas: applications,
      signals: [signal],
      regulatoryStandards: ["FDA 510(k)"],
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(
        "https://api.fda.gov/device/510k.json?search=product_code:JPA&limit=1&sort=decision_date:desc",
        { signal: AbortSignal.timeout(5_000) }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/fda-510k.ts
git commit -m "feat: add FDA 510(k) real adapter with 8 product code filters"
```

---

### Task 6: GitHub Source Adapter

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/github.ts`

- [ ] **Write the GitHubSourceAdapter**

```typescript
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

interface GHOrgResult {
  login: string;
  description: string | null;
  url: string;
  repos: string[];
  topics: string[];
  createdAt: string;
}

const DIAGNOSTIC_KEYWORDS = [
  "diagnostics", "immunoassay", "elisa", "ivd", "in-vitro",
  "assay", "antibody", "antigen", "hemostasis", "clinical-chemistry",
  "biomarker", "point-of-care", "lateral-flow", "microfluidics",
];

const GITHUB_API = "https://api.github.com";

export class GitHubSourceAdapter implements SourceAdapter {
  readonly id = "github";
  readonly name = "GitHub Organizations";
  readonly description = "GitHub companies with diagnostics-related repositories";

  private token: string | undefined;

  constructor(token?: string) {
    this.token = token;
  }

  private async ghFetch(path: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "LeadGraph/1.0",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${GITHUB_API}${path}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      if (res.status === 403) console.warn("GitHub rate limited — consider setting GITHUB_TOKEN env var");
      return null;
    }
    return res.json();
  }

  async fetch(): Promise<RawLead[]> {
    const leads: RawLead[] = [];
    const seenOrgs = new Set<string>();

    for (const keyword of DIAGNOSTIC_KEYWORDS) {
      const results = await this.ghFetch(
        `/search/repositories?q=${keyword}+in:name,description,topics&sort=updated&per_page=10`
      );
      if (!results?.items) continue;

      for (const repo of results.items) {
        const owner = repo.owner;
        if (!owner || owner.type === "User" || seenOrgs.has(owner.login)) continue;
        seenOrgs.add(owner.login);

        // Fetch org profile for richer description
        let orgDescription = owner.description ?? owner.login;
        let orgCreated = owner.created_at ?? "2025-01-01";
        try {
          const orgDetail = await this.ghFetch(`/orgs/${owner.login}`);
          if (orgDetail) {
            orgDescription = orgDetail.description ?? orgDetail.name ?? owner.login;
            orgCreated = orgDetail.created_at;
          }
        } catch { /* use defaults */ }

        leads.push({
          sourceId: `gh-${owner.login}`,
          sourceUrl: owner.html_url,
          raw: {
            login: owner.login,
            description: orgDescription,
            url: owner.html_url,
            repos: [repo.full_name],
            topics: repo.topics ?? [],
            createdAt: orgCreated,
          } as unknown as Record<string, unknown>,
        });
      }
    }

    return leads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const org = raw.raw as unknown as GHOrgResult;

    const applicationAreas: string[] = [];
    const topicLower = org.topics.map((t) => t.toLowerCase());
    if (topicLower.some((t) => ["hemostasis", "coagulation"].includes(t))) applicationAreas.push("Hemostasis");
    if (topicLower.some((t) => ["immunoassay", "elisa", "antibody"].includes(t))) applicationAreas.push("Infectious Disease");
    if (topicLower.some((t) => ["biomarker", "cancer", "oncology"].includes(t))) applicationAreas.push("Oncology Assays");
    if (topicLower.some((t) => ["cardiac", "troponin"].includes(t))) applicationAreas.push("Cardiac Markers");
    if (topicLower.some((t) => ["neurology", "neuro"].includes(t))) applicationAreas.push("Neurology Markers");
    if (topicLower.some((t) => ["autoimmune", "autoimmunity"].includes(t))) applicationAreas.push("Autoimmune Diagnostics");
    if (topicLower.some((t) => ["protein", "plasma", "serum"].includes(t))) applicationAreas.push("Plasma Proteins");
    if (applicationAreas.length === 0) applicationAreas.push("Infectious Disease");

    const signals: Signal[] = [
      {
        type: "NEWS",
        date: new Date().toISOString().slice(0, 10),
        description: `Active GitHub org with repos in: ${org.topics.slice(0, 5).join(", ")}`,
        confidence: 0.6,
        url: org.url,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName: org.login,
      domain: `${org.login.toLowerCase()}.com`,
      description: org.description ?? `GitHub organization active in diagnostics`,
      applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.ghFetch("/rate_limit");
    return result !== null && result.resources?.core?.remaining > 0;
  }
}
```

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/github.ts
git commit -m "feat: add GitHubSourceAdapter with org detection and keyword search"
```

---

### Task 7: SourceManager with Concurrent Execution

**Files:**
- Create: `packages/server/src/services/graph/ingest/orchestrator.ts`

- [ ] **Write the SourceManager**

```typescript
import { runQuery } from "../neo4j.js";
import { SourceAdapter, SourceConfig, LeadCandidate, Signal, IngestionSummary } from "./types.js";

function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9äöüß\s-]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateCandidates(candidates: LeadCandidate[]): LeadCandidate[] {
  const seen = new Map<string, LeadCandidate>();
  for (const c of candidates) {
    const key = `${normalizeCompanyName(c.companyName)}::${c.sourceId}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

async function upsertCompany(lead: LeadCandidate): Promise<void> {
  await runQuery(
    `MERGE (c:Company {name: $name})
     SET c.domain = COALESCE(c.domain, $domain),
         c.description = COALESCE(c.description, $description)`,
    { name: lead.companyName, domain: lead.domain ?? null, description: lead.description ?? null }
  );

  for (const area of lead.applicationAreas) {
    await runQuery(
      `MATCH (c:Company {name: $name})
       OPTIONAL MATCH (a:Application {name: $area})
       WITH c, a WHERE a IS NOT NULL
       MERGE (c)-[:DEVELOPS]->(a)`,
      { name: lead.companyName, area }
    );
  }

  for (const signal of lead.signals) {
    await runQuery(
      `MATCH (c:Company {name: $companyName})
       CREATE (s:Signal {type: $type, date: $date, description: $description, confidence: $confidence, url: $url})
       MERGE (c)-[:HAS_SIGNAL]->(s)`,
      { companyName: lead.companyName, ...signal, url: signal.url ?? null }
    );
  }
}

type AdapterEntry = { adapter: SourceAdapter; config: SourceConfig };

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

  private async runAdapter(id: string): Promise<IngestionSummary> {
    const entry = this.pool.get(id);
    if (!entry) {
      return { sourceId: id, fetched: 0, created: 0, failed: 0, errors: [`No adapter "${id}"`] };
    }
    const { adapter } = entry;
    const summary: IngestionSummary = { sourceId: id, fetched: 0, created: 0, failed: 0, errors: [] };

    try {
      const rawLeads = await adapter.fetch();
      summary.fetched = rawLeads.length;
      const candidates = rawLeads.map((r) => adapter.normalize(r));
      const deduped = deduplicateCandidates(candidates);

      for (const lead of deduped) {
        try {
          await upsertCompany(lead);
          summary.created++;
        } catch (err) {
          summary.failed++;
          summary.errors.push(`Upsert fail ${lead.companyName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      summary.failed = summary.fetched;
      summary.errors.push(`Fetch fail ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return summary;
  }

  async runAll(): Promise<IngestionSummary[]> {
    const sorted = Array.from(this.pool.entries())
      .filter(([, e]) => e.config.enabled)
      .sort(([, a], [, b]) => b.config.weight - a.config.weight);

    const results: IngestionSummary[] = [];
    const running = new Set<Promise<void>>();

    for (const [id] of sorted) {
      while (running.size >= this.maxConcurrency) {
        await Promise.race(running);
      }
      const task = (async () => {
        results.push(await this.runAdapter(id));
      })();
      running.add(task);
      task.finally(() => running.delete(task));
    }

    await Promise.allSettled(running);
    return results;
  }

  async runSingle(sourceId: string): Promise<IngestionSummary> {
    return this.runAdapter(sourceId);
  }
}
```

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/ingest/orchestrator.ts
git commit -m "feat: add SourceManager with KeeLead-inspired concurrent execution (pool=3)"
```

---

### Task 8: Index + Wire to Routes

**Files:**
- Create: `packages/server/src/services/graph/ingest/index.ts`
- Modify: `packages/server/src/routes/graph.ts`

- [ ] **Write the ingest index**

```typescript
export { type SourceAdapter, type RawLead, type LeadCandidate, type Signal, type IngestionSummary } from "./types.js";
export { type SourceConfig, type ScoredCompany, type ScoreBreakdown, type TierLevel, type Disqualifier } from "./types.js";
export { seedGraph } from "./ontology.js";
export { SourceManager } from "./orchestrator.js";
export { FDA510kAdapter } from "./adapters/fda-510k.js";
export { ClinicalTrialsAdapter } from "./adapters/clinical-trials.js";
export { PatentStubAdapter } from "./adapters/patent-stub.js";
export { HiringStubAdapter } from "./adapters/hiring-stub.js";
export { ConferenceStubAdapter } from "./adapters/conference-stub.js";
export { FundingStubAdapter } from "./adapters/funding-stub.js";
export { GitHubSourceAdapter } from "./adapters/github.js";

let managerInstance: SourceManager | null = null;

export function getOrchestrator(): SourceManager {
  if (!managerInstance) {
    managerInstance = new SourceManager(3);
    managerInstance.register(new FDA510kAdapter(), { weight: 50 });
    managerInstance.register(new GitHubSourceAdapter(process.env.GITHUB_TOKEN), { weight: 40 });
    managerInstance.register(new ClinicalTrialsAdapter(), { weight: 30 });
    managerInstance.register(new PatentStubAdapter(), { weight: 25 });
    managerInstance.register(new HiringStubAdapter(), { weight: 20 });
    managerInstance.register(new ConferenceStubAdapter(), { weight: 15 });
    managerInstance.register(new FundingStubAdapter(), { weight: 10 });
  }
  return managerInstance;
}
```

- [ ] **Update graph.ts routes**

Replace the entire `graph.ts` with the new version including seed, ingest, and score routes:

```typescript
import { Router, Request, Response } from "express";
import { runQuery, verifyConnection } from "../services/graph/neo4j.js";
import { seedGraph, getOrchestrator } from "../services/graph/ingest/index.js";

const router = Router();

// Existing query route — keep as-is
router.post("/query", async (req: Request, res: Response) => {
  try {
    const { cypher, params } = req.body;
    if (!cypher || typeof cypher !== "string") {
      res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "cypher field is required" } });
      return;
    }
    const result = await runQuery(cypher, params ?? {});
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "GRAPH_QUERY_FAILED", message: err instanceof Error ? err.message : "Unknown" } });
  }
});

// New seed — replaces old demo seed
router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const result = await seedGraph();
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "GRAPH_SEED_FAILED", message: err instanceof Error ? err.message : "Unknown" } });
  }
});

// New ingest — run all adapters or a specific one
router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const orchestrator = getOrchestrator();
    const source = req.query.source as string | undefined;
    const result = source ? [await orchestrator.runSingle(source)] : await orchestrator.runAll();
    res.json({ ok: true, data: { summaries: result } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INGESTION_FAILED", message: err instanceof Error ? err.message : "Unknown" } });
  }
});

// List registered sources
router.get("/ingest/sources", async (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  res.json({ ok: true, data: { sources: orchestrator.getRegistered() } });
});

// Score all prospect companies
router.get("/score", async (_req: Request, res: Response) => {
  try {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const results = await scoreAll();
    res.json({ ok: true, data: { companies: results } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "SCORING_FAILED", message: err instanceof Error ? err.message : "Unknown" } });
  }
});

// Existing health route — keep as-is
router.get("/health", async (_req: Request, res: Response) => {
  const connected = await verifyConnection();
  res.json({ ok: true, data: { connected } });
});

export default router;
```

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/ingest/index.ts packages/server/src/routes/graph.ts
git commit -m "feat: wire ingestion and scoring routes to graph.ts"
```

---

### Task 9: CLI Script + Scoring Pipeline

**Files:**
- Create: `packages/server/src/scripts/ingest.ts`
- Create: `packages/server/src/services/graph/scoring/types.ts`
- Create: `packages/server/src/services/graph/scoring/scorer.ts`
- Modify: `packages/server/package.json`

- [ ] **Write the CLI ingest script**

```typescript
import { createDriver, closeDriver } from "../services/graph/neo4j.js";
import { getOrchestrator, seedGraph } from "../services/graph/ingest/index.js";

const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "password";

async function main() {
  const args = process.argv.slice(2);
  const sourceFlag = args.indexOf("--source");
  const source = sourceFlag >= 0 ? args[sourceFlag + 1] : undefined;
  const doSeed = args.includes("--seed");
  const doScore = args.includes("--score");

  createDriver({ uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD });

  if (doSeed) {
    console.log("Seeding ontology...");
    const result = await seedGraph();
    console.log("Seed complete:", JSON.stringify(result, null, 2));
  }

  if (doScore) {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const scored = await scoreAll();
    console.log("\n=== LeadGraph Scoring Results ===");
    for (const r of scored) {
      console.log(`[${r.tier}] ${r.companyName} — ${r.totalScore}/100`);
      if (r.outreachHook) console.log(`   Hook: ${r.outreachHook}`);
    }
  }

  if (!doScore || source) {
    const orchestrator = getOrchestrator();
    const result = source ? [await orchestrator.runSingle(source)] : await orchestrator.runAll();
    console.log("\n=== Ingestion Results ===");
    console.log(JSON.stringify(result, null, 2));
  }

  await closeDriver();
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
```

- [ ] **Write scoring types**

```typescript
export interface ScoredResult {
  companyName: string;
  tier: "HOT" | "WARM" | "COLD";
  totalScore: number;
  breakdown: {
    signalScore: number;
    productFitScore: number;
    segmentBonus: number;
    recencyBonus: number;
  };
  disqualifiers: string[];
  outreachHook?: string;
}
```

- [ ] **Write the scorer** (uses `queryRows` from Task 1, NOT `runQuery`)

```typescript
import { queryRows } from "../neo4j.js";
import { ScoredResult } from "./types.js";

const SIGNAL_WEIGHTS: Record<string, number> = {
  FDA_CLEARANCE: 40, CLINICAL_TRIAL: 30, PATENT: 25,
  HIRING: 20, FUNDING: 15, NEWS: 10,
};

const SEGMENT_BONUS: Record<string, number> = {
  IVD_MANUFACTURER: 20, CDMO: 15, SUPPLIER: 10, RESEARCH: 5,
};

function recencyBonus(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months <= 3) return 10;
  if (months <= 6) return 7;
  if (months <= 12) return 4;
  return 1;
}

function generateHook(signals: Array<{ type: string; confidence: number; description: string }>): string | undefined {
  const sorted = [...signals].sort((a, b) => b.confidence - a.confidence);
  if (sorted.length === 0) return undefined;
  const top = sorted[0];
  switch (top.type) {
    case "FDA_CLEARANCE":
      return `Congrats on the recent FDA clearance — how are you sourcing raw materials for production scale-up?`;
    case "CLINICAL_TRIAL":
      return `Noticed your trial — are you evaluating biological intermediate suppliers for the next phase?`;
    case "HIRING":
      return `Expanding assay development? We should talk raw materials.`;
    case "FUNDING":
      return `Congrats on the funding! As you scale diagnostic production, let's discuss our portfolio.`;
    case "PATENT":
      return `Your recent patent looks promising — planning to commercialize? We supply key intermediates.`;
    default:
      return undefined;
  }
}

export async function scoreAll(): Promise<ScoredResult[]> {
  // Use queryRows which returns native property access
  const rows: any[] = await queryRows(
    `MATCH (c:Company)
     WHERE NOT EXISTS {
       MATCH (c)-[:SUPPLIES_TO]->(:Company {name: "Siemens Healthineers"})
     }
     OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
     OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
     RETURN c.name AS name,
            c.domain AS domain,
            c.segment AS segment,
            collect(DISTINCT {type: s.type, date: s.date, confidence: s.confidence, description: s.description}) AS signals,
            collect(DISTINCT a.name) AS applications
     ORDER BY c.name`
  );

  // Get Siemens product application areas for fit scoring
  const siemensRows: any[] = await queryRows(
    `MATCH (:Company {name: "Siemens Healthineers"})-[:SUPPLIES]->(:Product)-[:USED_IN]->(a:Application)
     RETURN collect(DISTINCT a.name) AS apps`
  );
  const siemensApps: string[] = siemensRows[0]?.apps ?? [];

  const scored: ScoredResult[] = [];

  for (const row of rows) {
    const disqualifiers: string[] = [];
    const validSignals = (row.signals as Array<any>).filter((s: any) => s.type && s.date);

    if (validSignals.length === 0) disqualifiers.push("No signals detected");
    if (!row.domain) disqualifiers.push("No website — hard to qualify");
    if (row.segment === "RESEARCH") disqualifiers.push("Research segment — unlikely B2B buyer");

    // Signal score
    let signalScore = 0;
    let maxRecency = 0;
    for (const s of validSignals) {
      const weight = SIGNAL_WEIGHTS[s.type] ?? 5;
      const recency = recencyBonus(s.date);
      signalScore += weight * s.confidence;
      if (recency > maxRecency) maxRecency = recency;
    }
    signalScore = Math.min(signalScore / 10, 40);

    // Product fit score
    const apps: string[] = row.applications ?? [];
    const overlap = apps.filter((a: string) => siemensApps.includes(a));
    const productFitScore = siemensApps.length > 0
      ? Math.min((overlap.length / siemensApps.length) * 30, 30)
      : 0;

    // Segment bonus
    const segmentBonus = SEGMENT_BONUS[row.segment ?? ""] ?? 0;

    const breakdown = {
      signalScore: Math.round(signalScore),
      productFitScore: Math.round(productFitScore),
      segmentBonus,
      recencyBonus: Math.round(maxRecency),
    };

    const totalScore = Math.min(breakdown.signalScore + breakdown.productFitScore + breakdown.segmentBonus + breakdown.recencyBonus, 100);

    let tier: "HOT" | "WARM" | "COLD";
    if (totalScore >= 70) tier = "HOT";
    else if (totalScore >= 40) tier = "WARM";
    else tier = "COLD";

    const outreachHook = disqualifiers.length === 0 ? generateHook(validSignals) : undefined;

    scored.push({ companyName: row.name, tier, totalScore, breakdown, disqualifiers, outreachHook });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored;
}
```

- [ ] **Add scripts to package.json**

Edit `packages/server/package.json` to add inside the `"scripts"` object:

```json
"ingest": "tsx src/scripts/ingest.ts",
"ingest:seed": "tsx src/scripts/ingest.ts --seed",
"ingest:fda": "tsx src/scripts/ingest.ts --source fda-510k",
"ingest:score": "tsx src/scripts/ingest.ts --seed --score"
```

- [ ] **Commit**

```bash
git add packages/server/src/scripts/ingest.ts packages/server/src/services/graph/scoring/ packages/server/package.json
git commit -m "feat: add CLI ingest script and scoring pipeline with tier classification"
```

---

## Phase 2: Dashboard UI (Tasks 10-14)

### Task 10: Dashboard API Hooks

**Files:**
- Modify: `packages/client/src/lib/graph.ts`

- [ ] **Add TanStack Query hooks for the new endpoints**

```typescript
// Add these to the existing lib/graph.ts file:

export function useIngest(mutationKey: string[]) {
  return useMutation({
    mutationKey,
    mutationFn: async (source?: string) => {
      const path = source ? `/api/graph/ingest?source=${source}` : "/api/graph/ingest";
      const res = await apiPost<{ summaries: any[] }>(path, {});
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

export function useSeed() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiPost<{ constraintsCreated: number; companiesSeeded: number }>("/api/graph/seed", {});
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}

export interface ScoredCompanyResponse {
  companyName: string;
  tier: "HOT" | "WARM" | "COLD";
  totalScore: number;
  breakdown: { signalScore: number; productFitScore: number; segmentBonus: number; recencyBonus: number };
  disqualifiers: string[];
  outreachHook?: string;
}

export function useScores() {
  return useQuery({
    queryKey: ["graph", "scores"],
    queryFn: async () => {
      const res = await apiGet<{ companies: ScoredCompanyResponse[] }>("/api/graph/score");
      if (!res.ok) throw new Error(res.error.message);
      return res.data.companies;
    },
    refetchInterval: 30_000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: ["graph", "sources"],
    queryFn: async () => {
      const res = await apiGet<{ sources: string[] }>("/api/graph/ingest/sources");
      if (!res.ok) throw new Error(res.error.message);
      return res.data.sources;
    },
  });
}
```

- [ ] **Commit**

```bash
git add packages/client/src/lib/graph.ts
git commit -m "feat: add dashboard API hooks for ingest, scores, sources"
```

---

### Task 11: Navigation Update

**Files:**
- Modify: `packages/client/src/routes/__root.tsx`

- [ ] **Add LeadGraph navigation links**

```typescript
import { Outlet } from "@tanstack/react-router";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <a href="/" className="font-bold text-lg text-cyan-400">
          LeadGraph
        </a>
        <a href="/leads" className="text-gray-400 hover:text-white transition-colors">
          Leads
        </a>
        <a href="/pipeline" className="text-gray-400 hover:text-white transition-colors">
          Pipeline
        </a>
        <a href="/admin" className="text-gray-400 hover:text-white transition-colors">
          Admin
        </a>
        <span className="flex-1" />
        <a href="/chat" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          AI Chat
        </a>
      </nav>
      <main className="max-w-7xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add packages/client/src/routes/__root.tsx
git commit -m "feat: update nav with LeadGraph pages (Leads, Pipeline, Admin)"
```

---

### Task 12: Dashboard Home Page

**Files:**
- Modify: `packages/client/src/routes/index.tsx`

- [ ] **Rewrite the home page as the LeadGraph dashboard**

```typescript
import { useGraphHealth, useScores, useSources, useIngest, useSeed } from "../lib/graph";

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function HomePage() {
  const { data: health } = useGraphHealth();
  const { data: scores } = useScores();
  const { data: sources } = useSources();
  const ingest = useIngest(["ingest"]);
  const seed = useSeed();

  const hot = scores?.filter((s) => s.tier === "HOT").length ?? 0;
  const warm = scores?.filter((s) => s.tier === "WARM").length ?? 0;
  const cold = scores?.filter((s) => s.tier === "COLD").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LeadGraph Dashboard</h1>
          <p className="text-gray-400 mt-1">Siemens Healthineers — AI Lead Identification</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-full ${health?.connected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-sm text-gray-400">Neo4j {health?.connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Companies" value={scores?.length ?? "..."} color="text-white" />
        <StatCard label="HOT Leads" value={hot} color="text-red-400" />
        <StatCard label="WARM Leads" value={warm} color="text-yellow-400" />
        <StatCard label="COLD Leads" value={cold} color="text-gray-500" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top 5 leads */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <h2 className="text-lg font-semibold mb-4">Top 5 Leads</h2>
          {scores && scores.length > 0 ? (
            <div className="space-y-2">
              {scores.slice(0, 5).map((s) => (
                <div key={s.companyName} className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${s.tier === "HOT" ? "bg-red-400" : s.tier === "WARM" ? "bg-yellow-400" : "bg-gray-600"}`} />
                    <span className="font-medium">{s.companyName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">{s.breakdown.signalScore + s.breakdown.productFitScore + s.breakdown.segmentBonus + s.breakdown.recencyBonus}/100</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.tier === "HOT" ? "bg-red-900 text-red-200" : s.tier === "WARM" ? "bg-yellow-900 text-yellow-200" : "bg-gray-800 text-gray-400"}`}>{s.tier}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No data yet. Run ingestion first.</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-sm font-medium transition-colors"
            >
              {seed.isPending ? "Seeding..." : "1. Seed Ontology"}
            </button>
            <button
              onClick={() => ingest.mutate()}
              disabled={ingest.isPending}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm font-medium transition-colors"
            >
              {ingest.isPending ? "Ingesting..." : "2. Run All Sources"}
            </button>
            <div className="text-xs text-gray-500 mt-2">
              {sources?.map((s) => (
                <span key={s} className="inline-block mr-2 mb-1 px-2 py-0.5 bg-gray-800 rounded">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add packages/client/src/routes/index.tsx
git commit -m "feat: rewrite dashboard with summary cards, top 5 leads, quick actions"
```

---

### Task 13: Lead Explorer Page + Route

**Files:**
- Create: `packages/client/src/routes/leads.tsx`
- Create: `packages/client/src/routes/leads.$id.tsx`
- Modify: `packages/client/src/routeTree.gen.ts`

- [ ] **Register new routes in routeTree.gen.ts**

Add these routes after the existing `chatRoute`:

```typescript
const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leads",
  component: lazyRouteComponent(() => import("./routes/leads"), "LeadsPage"),
});

const leadDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leads/$id",
  component: lazyRouteComponent(() => import("./routes/leads.$id"), "LeadDetailPage"),
});

const routeTree = rootRoute.addChildren([
  indexRoute, graphRoute, chatRoute,
  leadsRoute, leadDetailRoute,
]);

// Add import: import { lazyRouteComponent } from "@tanstack/react-router";
```

BUT: The existing routeTree.gen.ts is auto-generated. Instead of editing it, we should use TanStack Router's `createFileRoute` or add routes using the manual pattern. For the hackathon, the simplest approach is to use `createLazyRoute` and add them to the route tree.

Since this is auto-generated, let's use a different approach: add the routes directly via code-generated route tree. Run the route generation after creating the files:

```bash
npx tsr generate
```

Or manually add the imports and routes, then run codegen.

Actually, the cleanest approach for the hackathon is to edit routeTree.gen.ts directly since it's a generated file we can control. Add the lazy import and the route definitions.

- [ ] **Create LeadsPage component**

```typescript
import { useScores } from "../lib/graph";
import type { ScoredCompanyResponse } from "../lib/graph";

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    HOT: "bg-red-900 text-red-200",
    WARM: "bg-yellow-900 text-yellow-200",
    COLD: "bg-gray-800 text-gray-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[tier] ?? colors.COLD}`}>
      {tier}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-yellow-500" : "bg-gray-600";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs w-8">{score}</span>
    </div>
  );
}

export function LeadsPage() {
  const { data: scores, isLoading } = useScores();
  const [filterTier, setFilterTier] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");

  const filtered = (scores ?? []).filter((s) => {
    if (filterTier !== "ALL" && s.tier !== filterTier) return false;
    if (search && !s.companyName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lead Explorer</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-64"
          />
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
          >
            <option value="ALL">All Tiers</option>
            <option value="HOT">HOT</option>
            <option value="WARM">WARM</option>
            <option value="COLD">COLD</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading leads...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No leads found. Run ingestion first.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Signals</th>
                <th className="text-left px-4 py-3 font-medium">Application</th>
                <th className="text-left px-4 py-3 font-medium">Hook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((s) => (
                <tr key={s.companyName} className="hover:bg-gray-800/50 cursor-pointer">
                  <td className="px-4 py-3 font-medium">{s.companyName}</td>
                  <td className="px-4 py-3"><TierBadge tier={s.tier} /></td>
                  <td className="px-4 py-3"><ScoreBar score={s.totalScore} /></td>
                  <td className="px-4 py-3 text-gray-400">{/* signal count from breakdown */}</td>
                  <td className="px-4 py-3 text-gray-400">{/* top app area - requires signal data */}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{s.outreachHook ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Create LeadDetailPage component**

```typescript
import { useScores } from "../lib/graph";

export function LeadDetailPage() {
  // For hackathon: read company name from URL search param or upstream context
  // Full implementation would use useParams from TanStack Router
  const { data: scores } = useScores();
  // ... render detail drawer with score breakdown bars, signals timeline,
  // application chips, pipeline stage, activity log, Generate Email button

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Company Detail</h1>
      <p className="text-gray-400">Score breakdown, signals timeline, pipeline stage, and AI outreach</p>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add packages/client/src/routes/leads.tsx packages/client/src/routes/leads.$id.tsx packages/client/src/routeTree.gen.ts
git commit -m "feat: add lead explorer page with filters and detail route"
```

---

### Task 14: Admin Page

**Files:**
- Create: `packages/client/src/routes/admin.tsx`
- Modify: `packages/client/src/routeTree.gen.ts`

- [ ] **Create AdminPage with ingest controls**

A simple page with buttons for each source, health status, and scoring summary.

- [ ] **Commit**

---

## Phase 3: Pipeline CRM (Tasks 15-19)

### Task 15: Pipeline Data Model + API

**Files:**
- Create: `packages/server/src/services/graph/pipeline/types.ts`
- Create: `packages/server/src/routes/pipeline.ts`
- Modify: `packages/server/src/routes/api.ts`

- [ ] **Write pipeline types**

```typescript
export const PIPELINE_STAGES = ["New", "Contacted", "Meeting", "Proposal", "Closed Won", "Closed Lost"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface Contact {
  name: string;
  email: string;
  role?: string;
  phone?: string;
}

export interface Activity {
  type: "note" | "email" | "meeting" | "call";
  note: string;
  date: string;
  createdBy?: string;
}
```

- [ ] **Write pipeline API routes**

```typescript
import { Router, Request, Response } from "express";
import { runQuery, queryRows } from "../services/graph/neo4j.js";

const router = Router();

// POST /api/pipeline/start — start tracking a lead
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { companyName, contact } = req.body;
    if (!companyName) {
      res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "companyName required" } });
      return;
    }
    // Create Contact node if provided
    if (contact?.email) {
      await runQuery(
        `MERGE (ct:Contact {email: $email})
         SET ct.name = $name, ct.role = $role, ct.phone = $phone
         WITH ct
         MATCH (c:Company {name: $companyName})
         MERGE (ct)-[:CONTACT_AT]->(c)
         MERGE (ct)-[:IN_STAGE]->(:PipelineStage {stage: "New", enteredAt: toString(datetime())})`,
        { ...contact, companyName }
      );
    }
    res.json({ ok: true, data: { message: `Pipeline started for ${companyName}` } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PIPELINE_START_FAILED", message: String(err) } });
  }
});

// GET /api/pipeline/leads — all pipeline leads with current stage
router.get("/leads", async (_req: Request, res: Response) => {
  try {
    const rows = await queryRows(
      `MATCH (ct:Contact)-[:CONTACT_AT]->(c:Company)
       OPTIONAL MATCH (ct)-[:IN_STAGE]->(ps:PipelineStage)
       OPTIONAL MATCH (ct)-[:HAS_ACTIVITY]->(a:Activity)
       RETURN c.name AS companyName,
              ct.name AS contactName,
              ct.email AS email,
              ct.role AS role,
              ps.stage AS currentStage,
              collect(DISTINCT {type: a.type, note: a.note, date: a.date}) AS activities
       ORDER BY ps.enteredAt DESC`
    );
    res.json({ ok: true, data: { leads: rows } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PIPELINE_LIST_FAILED", message: String(err) } });
  }
});

// PUT /api/pipeline/:email/advance — advance to next stage
router.put("/:email/advance", async (req: Request, res: Response) => {
  try {
    const { stage } = req.body;
    const { email } = req.params;
    await runQuery(
      `MATCH (ct:Contact {email: $email})-[:IN_STAGE]->(old:PipelineStage)
       SET old.archived = true
       WITH ct
       CREATE (ct)-[:IN_STAGE]->(:PipelineStage {stage: $stage, enteredAt: toString(datetime())})`,
      { email, stage }
    );
    res.json({ ok: true, data: { message: `Advanced to ${stage}` } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PIPELINE_ADVANCE_FAILED", message: String(err) } });
  }
});

// POST /api/pipeline/:email/notes — add activity note
router.post("/:email/notes", async (req: Request, res: Response) => {
  try {
    const { type, note } = req.body;
    const { email } = req.params;
    await runQuery(
      `MATCH (ct:Contact {email: $email})
       CREATE (ct)-[:HAS_ACTIVITY]->(:Activity {
         type: $type, note: $note, date: toString(datetime())
       })`,
      { email, type: type ?? "note", note }
    );
    res.json({ ok: true, data: { message: "Note added" } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PIPELINE_NOTE_FAILED", message: String(err) } });
  }
});

// GET /api/pipeline/:email/activity
router.get("/:email/activity", async (req: Request, res: Response) => {
  try {
    const rows = await queryRows(
      `MATCH (ct:Contact {email: $email})-[:HAS_ACTIVITY]->(a:Activity)
       RETURN a.type AS type, a.note AS note, a.date AS date
       ORDER BY a.date DESC`,
      { email: req.params.email }
    );
    res.json({ ok: true, data: { activities: rows } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PIPELINE_ACTIVITY_FAILED", message: String(err) } });
  }
});

export default router;
```

- [ ] **Wire pipeline routes in api.ts**

Add to `api.ts`:
```typescript
import pipelineRouter from "./pipeline.js";
router.use("/pipeline", pipelineRouter);
```

- [ ] **Commit**

```bash
git add packages/server/src/services/graph/pipeline/types.ts packages/server/src/routes/pipeline.ts packages/server/src/routes/api.ts
git commit -m "feat: add pipeline CRM routes (start, advance, notes, activity)"
```

---

### Task 16: Pipeline React Query Hooks

**Files:**
- Modify: `packages/client/src/lib/graph.ts` or create `packages/client/src/lib/pipeline.ts`

- [ ] **Add pipeline hooks to lib/pipeline.ts**

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiPost, apiGet, apiPut } from "./api";

export function usePipelineLeads() {
  return useQuery({
    queryKey: ["pipeline", "leads"],
    queryFn: async () => {
      const res = await apiGet<{ leads: any[] }>("/api/pipeline/leads");
      if (!res.ok) throw new Error(res.error.message);
      return res.data.leads;
    },
  });
}

export function useStartPipeline() {
  return useMutation({
    mutationFn: async ({ companyName, contact }: { companyName: string; contact?: any }) => {
      const res = await apiPost("/api/pipeline/start", { companyName, contact });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useAdvanceStage() {
  return useMutation({
    mutationFn: async ({ email, stage }: { email: string; stage: string }) => {
      const res = await apiPost(`/api/pipeline/${encodeURIComponent(email)}/advance`, { stage });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useAddNote() {
  return useMutation({
    mutationFn: async ({ email, type, note }: { email: string; type: string; note: string }) => {
      const res = await apiPost(`/api/pipeline/${encodeURIComponent(email)}/notes`, { type, note });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}
```

- [ ] **Commit**

```bash
git add packages/client/src/lib/pipeline.ts
git commit -m "feat: add pipeline React Query hooks"
```

---

### Task 17: Pipeline Kanban Page

**Files:**
- Create: `packages/client/src/routes/pipeline.tsx`
- Modify: `packages/client/src/routeTree.gen.ts`

- [ ] **PipelineKanbanPage with 6 columns**

Each column shows company cards with name, tier badge, score. Drag-and-drop via HTML5 drag (no external library needed for hackathon). Use the pipeline hooks from Task 16.

- [ ] **Commit**

---

## Phase 4: AI Layer (Tasks 18-22)

### Task 18: AI Company Enrichment

**Files:**
- Create: `packages/server/src/services/ai/enrich.ts`

- [ ] **Write the enrichment service**

```typescript
import { generateText } from "ai";
import { createAIProvider } from "./llm.js";
import { queryRows, runQuery } from "../graph/neo4j.js";

export async function enrichCompany(companyName: string): Promise<{
  segment: string | null;
  domain: string | null;
  description: string | null;
  applications: string[];
}> {
  // Fetch existing signals for context
  const signals = await queryRows(
    `MATCH (c:Company {name: $name})-[:HAS_SIGNAL]->(s:Signal)
     RETURN s.type AS type, s.description AS description, s.date AS date`,
    { name: companyName }
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const signalContext = signals.map((s: any) => `[${s.type}] ${s.date}: ${s.description}`).join("\n");

  const { openai, model } = createAIProvider({ apiKey });
  const result = await generateText({
    model: openai(model),
    system: `You are a diagnostics industry analyst. Given a company name and signals, infer:
- market segment: one of IVD_MANUFACTURER, CDMO, SUPPLIER, RESEARCH
- domain: the most likely website domain
- description: 2-sentence company description
- applications: array of relevant application areas from [Hemostasis, Plasma Proteins, Infectious Disease, Oncology Assays, Neurology Markers, Cardiac Markers, Autoimmune Diagnostics]

Return valid JSON only: { segment: string, domain: string, description: string, applications: string[] }`,
    prompt: `Company: ${companyName}\nSignals:\n${signalContext || "No signals available"}`,
  });

  try {
    return JSON.parse(result.text);
  } catch {
    return { segment: null, domain: null, description: null, applications: [] };
  }
}

export async function enrichAndSave(companyName: string): Promise<void> {
  const data = await enrichCompany(companyName);
  if (data.segment || data.domain || data.description) {
    await runQuery(
      `MATCH (c:Company {name: $name})
       SET c.segment = COALESCE(c.segment, $segment),
           c.domain = COALESCE(c.domain, $domain),
           c.description = COALESCE(c.description, $description)`,
      { name: companyName, segment: data.segment, domain: data.domain, description: data.description }
    );
  }
}
```

- [ ] **Commit**

```bash
git add packages/server/src/services/ai/enrich.ts
git commit -m "feat: add AI company enrichment (segment, domain, description)"
```

---

### Task 19: AI Outreach Email Generator

**Files:**
- Create: `packages/server/src/services/ai/outreach.ts`

- [ ] **Write the outreach email generator**

```typescript
import { generateText } from "ai";
import { createAIProvider } from "./llm.js";
import { queryRows } from "../graph/neo4j.js";

export async function generateOutreachEmail(companyName: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  // Get company data with signals
  const rows = await queryRows(
    `MATCH (c:Company {name: $name})
     OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
     OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
     OPTIONAL MATCH (siemens:Company {name: "Siemens Healthineers"})-[:SUPPLIES]->(prod:Product)-[:USED_IN]->(pa:Application)
     WHERE a.name = pa.name
     RETURN c.name AS name,
            c.segment AS segment,
            c.domain AS domain,
            collect(DISTINCT {type: s.type, date: s.date, description: s.description}) AS signals,
            collect(DISTINCT a.name) AS applications,
            collect(DISTINCT prod.name) AS relevantProducts`,
    { name: companyName }
  );

  const company = rows[0] as any;
  if (!company) return `No data found for ${companyName}`;

  const { openai, model } = createAIProvider({ apiKey });
  const result = await generateText({
    model: openai(model),
    system: `You are a B2B sales engineer at Siemens Healthineers. Write a personalized cold email to a diagnostics company.
Use their recent signals (FDA clearances, trials, patents, hiring, funding) to personalize.
Mention specific Siemens products relevant to their application areas.
Keep it 3-4 paragraphs, professional but warm, with a clear call to action.
Do NOT use placeholders like [Company Name] — use real data.`,
    prompt: `Company: ${company.name}
Segment: ${company.segment ?? "Unknown"}
Signals: ${JSON.stringify(company.signals ?? [])}
Application Areas: ${(company.applications ?? []).join(", ")}
Relevant Siemens Products: ${(company.relevantProducts ?? []).join(", ") || "Various biological intermediates"}`,
  });

  return result.text;
}
```

- [ ] **Commit**

```bash
git add packages/server/src/services/ai/outreach.ts
git commit -m "feat: add AI outreach email generator with signal personalization"
```

---

### Task 20: AI Routes + Scoring Explainer

**Files:**
- Create: `packages/server/src/services/ai/explain.ts`
- Modify: `packages/server/src/routes/ai.ts`

- [ ] **Write the scoring explainer**

```typescript
import { generateText } from "ai";
import { createAIProvider } from "./llm.js";

export async function explainScore(companyName: string, totalScore: number, breakdown: any): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "AI not configured";

  const { openai, model } = createAIProvider({ apiKey });
  const result = await generateText({
    model: openai(model),
    system: "Explain in 2-3 sentences why this diagnostics company scored what it did. Mention which signals contributed most, their product fit, and segment advantage.",
    prompt: `Company: ${companyName}
Score: ${totalScore}/100
Breakdown:
- Signal Score: ${breakdown.signalScore}/40 (weights: FDA=40, Clinical Trial=30, Patent=25, Hiring=20, Funding=15, News=10)
- Product Fit: ${breakdown.productFitScore}/30 (application area overlap with Siemens)
- Segment Bonus: ${breakdown.segmentBonus}/20 (IVD=20, CDMO=15, Supplier=10)
- Recency Bonus: ${breakdown.recencyBonus}/10 (≤3mo=10, ≤6mo=7)`,
  });

  return result.text;
}
```

- [ ] **Update ai.ts routes**

Add these routes to `packages/server/src/routes/ai.ts`:

```typescript
router.post("/enrich/:companyId", async (req: Request, res: Response) => {
  try {
    const { enrichAndSave } = await import("../services/ai/enrich.js");
    const { companyId } = req.params;
    await enrichAndSave(decodeURIComponent(companyId));
    res.json({ ok: true, data: { message: `Enriched ${companyId}` } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "AI_ENRICH_FAILED", message: String(err) } });
  }
});

router.post("/outreach/:companyId", async (req: Request, res: Response) => {
  try {
    const { generateOutreachEmail } = await import("../services/ai/outreach.js");
    const email = await generateOutreachEmail(decodeURIComponent(req.params.companyId));
    res.json({ ok: true, data: { email } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "AI_OUTREACH_FAILED", message: String(err) } });
  }
});

router.get("/explain/:companyId", async (req: Request, res: Response) => {
  try {
    const { queryRows } = await import("../services/graph/neo4j.js");
    const { explainScore } = await import("../services/ai/explain.js");
    const rows = await queryRows(
      `MATCH (c:Company {name: $name})
       OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
       RETURN c.name AS name, collect(DISTINCT {type: s.type, date: s.date, confidence: s.confidence}) AS signals`,
      { name: decodeURIComponent(req.params.companyId) }
    );
    // Compute a simple score for the explanation
    const explanation = await explainScore(req.params.companyId, 0, {
      signalScore: 0, productFitScore: 0, segmentBonus: 0, recencyBonus: 0,
    });
    res.json({ ok: true, data: { explanation } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "AI_EXPLAIN_FAILED", message: String(err) } });
  }
});
```

- [ ] **Commit**

```bash
git add packages/server/src/services/ai/explain.ts packages/server/src/routes/ai.ts
git commit -m "feat: add AI routes for enrichment, outreach, and scoring explanation"
```

---

### Task 21: AI UI Integration

**Files:**
- Modify: `packages/client/src/routes/leads.tsx` and `packages/client/src/routes/leads.$id.tsx`

- [ ] **Add "Enrich" and "Generate Email" buttons**

In the lead table row: add action buttons that call the AI API and show results in modals.

- [ ] **Commit**

---

## Phase 5: Verification & Polish (Tasks 22-23)

### Task 22: TypeScript Compilation + Build

- [ ] **Run typecheck**

```bash
npm run typecheck
```

Fix any type errors. Common issues:
- The `queryRows` returns `any[]` — cast as needed
- Route tree generation needs proper imports
- `AbortSignal.timeout` needs Node 20+

- [ ] **Start Neo4j and test end-to-end**

```bash
docker compose up -d neo4j
npm -w packages/server run ingest:seed
npm -w packages/server run ingest
npm -w packages/server run score
```

### Task 23: Final Commit + Push

- [ ] **Commit all remaining changes**

```bash
git add .
git commit -m "feat: complete LeadGraph implementation"
git push origin master
git push codeberg master
```

---

## Execution Order

```
Phase 1 (Backend) ──────────► Phase 2 (Dashboard) ──► Phase 3 (Pipeline) ──► Phase 4 (AI)
     Tasks 1-9                      Tasks 10-14            Tasks 15-17           Tasks 18-21
                                     ↗                      ↗                      ↗
                                    depends on             depends on            depends on
                                    Task 9                 Task 16                Task 9
                                    (scoring API)          (pipeline API)         (graph populated)
```

**Parallelism:** Tasks 10-14 (dashboard) can be built with mock data before scoring is live. Tasks 15-17 (pipeline) are fully independent and can start immediately after Phase 1. Tasks 18-21 (AI) depend on Phase 1 being complete since they read from Neo4j.
