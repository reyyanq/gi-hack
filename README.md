# Gi-Hack — AI Graph TanStack Boilerplate

A ready-to-hack boilerplate for the **StartMiUp Hackathon – AI for Mittelhessen**.

## What's Inside

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS v4 |
| Backend | Express + TypeScript (tsx watch) |
| Graph DB | Neo4j 5 Community + APOC (Docker) |
| AI | Vercel AI SDK (OpenAI, swappable) |

## Quick Start

**Prerequisites:** Node.js 20+, Docker, npm

```bash
# 1. Start Neo4j
docker compose up -d neo4j

# 2. Configure environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY

# 3. Install dependencies
npm install

# 4. Start development
npm run dev
```

Open **http://localhost:5173** — client on :5173, server on :3001, Neo4j Browser on :7474.

## Project Structure

```
gi-hack/
├── packages/
│   ├── client/          # Vite + React + TanStack
│   │   └── src/
│   │       ├── routes/  # Route definitions
│   │       └── lib/     # API hooks (graph, ai, query client)
│   ├── server/          # Express API
│   │   └── src/
│   │       ├── routes/  # API endpoints
│   │       └── services/# Neo4j + AI services
│   └── shared/          # TypeScript types
├── docker-compose.yml   # Neo4j service
├── .env.example         # Config template
└── docs/                # Architecture documentation
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/graph/health` | Neo4j connectivity check |
| POST | `/api/graph/query` | Execute Cypher query |
| POST | `/api/graph/seed` | Seed demo data |
| POST | `/api/ai/ask` | Ask AI (optionally with graph context) |

## Architecture

See [`docs/superpowers/specs/2026-06-04-ai-graph-tanstack-boilerplate-design.md`](docs/superpowers/specs/2026-06-04-ai-graph-tanstack-boilerplate-design.md) for the full arc42 design document.

---

# LeadGraph — Siemens Healthineers Challenge

**Problem:** Siemens Healthineers produces biological intermediates (proteins, antibodies, latex particles, blockers) at their Marburg site but lacks a B2B sales structure to identify and prioritize potential buyers.

**Solution:** Neo4j knowledge graph + AI lead scoring platform that automatically discovers, ranks, and surfaces diagnostic companies actively developing new assays.

See the full spec at [`docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md`](docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md) and the implementation plan at [`docs/superpowers/plans/2026-06-05-leadgraph-ingestion.md`](docs/superpowers/plans/2026-06-05-leadgraph-ingestion.md).

---

## Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          LEADGRAPH — FULL SOFTWARE ARCHITECTURE                   │
│              Siemens Healthineers — AI Lead Identification Platform                │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React 19 + Vite + TanStack Router/Query + Tailwind v4)                │
│  Layers: routes/ → pages, lib/ → API hooks, components/ → reusable UI             │
│                                                                                  │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐              │
│  │ Dashboard (Home) Page        │  │ Lead Explorer Page            │              │
│  │  ├─ Pipeline Summary Cards   │  │  ├─ Score-sorted DataTable    │              │
│  │  │  🔥 HOT: X  ⭐ WARM: Y   │  │  ├─ Filter bar (tier,segment) │              │
│  │  │     COLD: Z               │  │  ├─ Company detail drawer    │              │
│  │  ├─ Source Health Status     │  │  │   ├─ Signals timeline     │              │
│  │  ├─ Top 5 leads card         │  │  │   ├─ Score breakdown bar  │              │
│  │  └─ [Run Ingest] button      │  │  │   └─ Outreach hook        │              │
│  └──────────────────────────────┘  └──────────────────────────────┘              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐              │
│  │ Pipeline Kanban Page         │  │ Ingest Control Panel         │              │
│  │  ├─ Columns: New → Contacted │  │  ├─ [Seed Ontology] button   │              │
│  │  │  → Meeting → Proposal     │  │  ├─ Run per-source ingest    │              │
│  │  │  → Closed Won/Lost        │  │  └─ View ingestion logs     │              │
│  │  ├─ Drag leads between cols  │  │                              │              │
│  │  └─ Activity timeline per    │  │                              │              │
│  │     lead (notes, status      │  │                              │              │
│  │     changes, emails)         │  │                              │              │
│  └──────────────────────────────┘  └──────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────┘
           │                                     ▲
           │  HTTP / JSON (TanStack Query)       │
           ▼                                     │
┌──────────────────────────────────────────────────────────────────────────────────┐
│  API SERVER (Express + TypeScript — :3001)                                        │
│  Routes: /api/graph/*, /api/pipeline/*, /api/ai/*                                 │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                     INGESTION LAYER (services/graph/ingest/)                │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  SourceManager (KeeLead-inspired) — pool=3, weight-sorted         │    │   │
│  │  │                                                                   │    │   │
│  │  │  Weight:  FDA=50 │ GitHub=40 │ ClinicalTrials=30 │ Patent=25      │    │   │
│  │  │          Hiring=20│Conference=15│Funding=10                        │    │   │
│  │  │                                                                   │    │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │    │   │
│  │  │  │FDA 510(k)│ │  GitHub  │ │ Clinical │ │  Patent  │ │ Hiring │  │    │   │
│  │  │  │  REAL    │ │  REAL    │ │  Trials  │ │  Stub    │ │ Stub   │  │    │   │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘  │    │   │
│  │  │  ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌───▼────┐  │    │   │
│  │  │  │Conference│ │ Funding  │ │          │ │          │ │        │  │    │   │
│  │  │  │  Stub    │ │  Stub    │ │  ...     │ │          │ │        │  │    │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘  │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  SCORING PIPELINE (services/graph/scoring/)                        │    │   │
│  │  │  Reads: Company → HAS_SIGNAL → Signal                              │    │   │
│  │  │         Company → DEVELOPS → Application                           │    │   │
│  │  │                                                                   │    │   │
│  │  │  For each Company WITHOUT SUPPLIES_TO relationship to Siemens:     │    │   │
│  │  │   1. SignalScore = Σ(weight × confidence × recency)       [0-40]  │    │   │
│  │  │   2. ProductFit = appOverlapRatio × 30                     [0-30]  │    │   │
│  │  │   3. SegmentBonus: IVD=20 / CDMO=15 / Supplier=10 / ...   [0-20]  │    │   │
│  │  │   4. RecencyBonus: ≤3mo=10 / ≤6mo=7 / ≤12mo=4 / >12mo=1  [0-10]  │    │   │
│  │  │   5. Check hard disqualifiers (no signals, no domain, ...)        │    │   │
│  │  │   6. Total = signal + fit + segment + recency              [0-100] │    │   │
│  │  │   7. Tier: HOT ≥ 70 / WARM ≥ 40 / COLD < 40                      │    │   │
│  │  │   8. Generate outreachHook from strongest signal type             │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  PIPELINE CRM (services/graph/pipeline/)                          │    │   │
│  │  │                                                                   │    │   │
│  │  │  Nodes:    (:Contact), (:Activity), (:PipelineStage)              │    │   │
│  │  │  Edges:    (c)-[:CONTACT_AT]->(Company)                           │    │   │
│  │  │            (c)-[:HAS_ACTIVITY]->(:Activity {type, note, date})    │    │   │
│  │  │            (c)-[:IN_STAGE]->(:PipelineStage {stage, enteredAt})    │    │   │
│  │  │                                                                   │    │   │
│  │  │  Stages:  New → Contacted → Meeting → Proposal → Closed Won/Lost  │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │   │
│  │  │  AI LAYER (services/ai/)                                           │    │   │
│  │  │                                                                   │    │   │
│  │  │  Enrich:    (Company.name + signals) → LLM → (segment, domain,    │    │   │
│  │  │              applications, description)                             │    │   │
│  │  │  Outreach:  (Company + signals + tier) → LLM → (personalized      │    │   │
│  │  │              cold email with product recommendation)                │    │   │
│  │  │  Explain:   (Company + breakdown) → LLM → (plain-text "why this   │    │   │
│  │  │              lead scores what it does" justification)               │    │   │
│  │  └───────────────────────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
           │
           │  runQuery() — neo4j-driver (Bolt :7687)
           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  NEO4j KNOWLEDGE GRAPH (Docker — bolt://localhost:7687, Browser :7474)            │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │  Node Types                   │  Relationships                           │   │
│  │                               │                                          │   │
│  │  (:Company)                   │  (c)-[:SUPPLIES]->(:Product)             │   │
│  │    .name (UNIQUE)             │  (c)-[:DEVELOPS]->(:Application)         │   │
│  │    .domain (INDEXED)          │  (c)-[:HAS_SIGNAL]->(:Signal)            │   │
│  │    .segment                    │  (p)-[:USED_IN]->(:Application)          │   │
│  │    .region                     │  (c)-[:CONTACT_AT]->(:Contact)          │   │
│  │                               │  (c)-[:IN_STAGE]->(:PipelineStage)       │   │
│  │  (:Application)               │  (c)-[:HAS_ACTIVITY]->(:Activity)        │   │
│  │    .name (UNIQUE)             │                                          │   │
│  │    .category                   │                                          │   │
│  │    .marketSize                 │                                          │   │
│  │                               │                                          │   │
│  │  (:Product)                    │                                          │   │
│  │    .catalogId                  │                                          │   │
│  │    .name                       │                                          │   │
│  │    .category                   │                                          │   │
│  │                               │                                          │   │
│  │  (:Signal)                     │                                          │   │
│  │    .type (INDEXED)             │                                          │   │
│  │    .date                       │                                          │   │
│  │    .confidence (0-1)           │                                          │   │
│  │    .description                │                                          │   │
│  │    .url                        │                                          │   │
│  │                               │                                          │   │
│  │  (:Contact)                    │                                          │   │
│  │    .name, .email, .role        │                                          │   │
│  │                               │                                          │   │
│  │  (:PipelineStage)              │                                          │   │
│  │    .stage, .enteredAt          │                                          │   │
│  │                               │                                          │   │
│  │  (:Activity)                   │                                          │   │
│  │    .type, .note, .date         │                                          │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
           ▲
           │
┌──────────────────────────────────────────────────────────────────────────────────┐
│  DATA SOURCES (External)                                                           │
│                                                                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │  api.fda.gov     │ │  api.github.com  │ │  Stub: Clinical │ │  Stub: Patent   ││
│  │  /device/510k    │ │  /search/repos   │ │  Trials.gov    │ │  Filings        ││
│  │  ─────────────── │ │  /orgs/{login}  │ │  ─────────────  │ │  ─────────────  ││
│  │  REAL            │ │  ─────────────── │ │  4 simulated   │ │  5 simulated    ││
│  │  FDA clearance   │ │  REAL            │ │  trial records  │ │  patent records ││
│  │  → product codes │ │  Diag. keyword   │ │  with phases    │ │  with IPC codes ││
│  │  JPA, JSO, JXV   │ │  search on GH    │ │                 │ │                 ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘│
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │  Stub: Hiring   │ │  Stub: Conf.    │ │  Stub: Funding  │ │  Docling        ││
│  │  (LinkedIn-like)│ │  (MEDICA/ADLM)  │ │  Investment     │ │  (Future)       ││
│  │  ─────────────  │ │  ─────────────  │ │  ─────────────  │ │  ─────────────  ││
│  │  5 simulated    │ │  5 simulated    │ │  4 simulated    │ │  Python sidecar ││
│  │  R&D/QA roles   │ │  exhibitor recs │ │  VC/Grant recs  │ │  PDF → JSON     ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────────┐
│  REFERENCE REPOSITORY BORROWINGS (sources/, for inspiration only)                  │
│                                                                                  │
│  KeeLead (MIT)  ──→ SourceManager concurrency, per-source weights & config       │
│  Gitsneak (MIT) ──→ GitHub org detection, profile scraping, API caching          │
│  OpenGTM (MIT)  ──→ Tier system (HOT/WARM/COLD), ICP profiles, segment scoring   │
│  Lead Engine ─────→ Hard disqualifiers, outreach hooks from score breakdown       │
│  Intent-Detection  ──→ Signal taxonomy (FDA/Trial/Patent/Hiring/Funding/NEWS)    │
│    Agent (MIT)         + weighted scoring pipeline                                 │
└──────────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT (Docker Compose)                                                       │
│                                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                     │
│  │  Frontend    │────▶│  API Server  │────▶│  Neo4j       │                     │
│  │  :5173       │     │  :3001       │     │  :7687       │                     │
│  │  Vite dev    │     │  Express     │     │  APOC + GDS  │                     │
│  └──────────────┘     └──────────────┘     └──────────────┘                     │
│                                                                                  │
│  Env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY, GITHUB_TOKEN (opt)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan (23 Tasks, 5 Phases)

> Full code for each task in [`docs/superpowers/plans/2026-06-05-leadgraph-comprehensive-plan.md`](docs/superpowers/plans/2026-06-05-leadgraph-comprehensive-plan.md)

### Phase 1: Backend Ingestion + Scoring

| # | Check | Task | Files |
|---|-------|------|-------|
| 1 | `[ ]` | **queryRows helper** — add native-record Cypher helper to `neo4j.ts` for scorer | `services/graph/neo4j.ts` |
| 2 | `[ ]` | **Types** — SourceAdapter interface, SourceConfig, scoring types (TierLevel, ScoreBreakdown, ScoredCompany) | `services/graph/ingest/types.ts` |
| 3 | `[ ]` | **Ontology seed** — constraints, 7 applications, 10 Siemens products, 15 competitor companies, seed signals | `services/graph/ingest/ontology.ts` |
| 4 | `[ ]` | **5 stub adapters** — ClinicalTrials, Patent, Hiring, Conference, Funding (hardcoded records → LeadCandidate) | `services/graph/ingest/adapters/*-stub.ts` |
| 5 | `[ ]` | **FDA adapter** — real `api.fda.gov/device/510k` with 8 product code filters, company extraction | `services/graph/ingest/adapters/fda-510k.ts` |
| 6 | `[ ]` | **GitHub adapter** — real `api.github.com` keyword search, org detection, topic→application mapping | `services/graph/ingest/adapters/github.ts` |
| 7 | `[ ]` | **SourceManager** — concurrent runner, pool=3, weight-sorted, dedup, Neo4j upsert | `services/graph/ingest/orchestrator.ts` |
| 8 | `[ ]` | **Index + routes** — singleton SourceManager with all 7 adapters, POST /ingest, GET /sources | `ingest/index.ts`, `routes/graph.ts` |
| 9 | `[ ]` | **CLI + Scoring** — `npm run ingest`, `npm run score`. Scorer computes signal (0-40) + product fit (0-30) + segment bonus (0-20) + recency (0-10) → HOT/WARM/COLD | `scripts/ingest.ts`, `scoring/scorer.ts` |

> **Depends on:** Nothing. **Delivers:** Neo4j populated with companies, signals, scores.

### Phase 2: Dashboard UI (React)

| # | Check | Task | Files |
|---|-------|------|-------|
| 10 | `[ ]` | **API hooks** — useIngest, useSeed, useScores, useSources in TanStack Query | `client/src/lib/graph.ts` |
| 11 | `[ ]` | **Navigation** — add Leads, Pipeline, Admin links to RootLayout | `client/src/routes/__root.tsx` |
| 12 | `[ ]` | **Dashboard home** — 4 summary cards, Top 5 leads, Quick Actions (Seed/Ingest buttons) | `client/src/routes/index.tsx` |
| 13 | `[ ]` | **Lead Explorer** — score-sorted table with tier badges + score bars, search/filter, detail drawer with signals timeline + breakdown + outreach hook | `client/src/routes/leads*.tsx` |
| 14 | `[ ]` | **Admin panel** — per-source Run buttons, health status, scoring summary, Neo4j stats | `client/src/routes/admin.tsx` |

> **Depends on:** Phase 1 (for data), but buildable with mock data. **Delivers:** Full UI to browse/explore/scored leads.

### Phase 3: Pipeline CRM

| # | Check | Task | Files |
|---|-------|------|-------|
| 15 | `[ ]` | **Pipeline data model + API** — Contact/PipelineStage/Activity Cypher, POST start, PUT advance, GET leads, POST notes | `services/graph/pipeline/`, `routes/pipeline.ts` |
| 16 | `[ ]` | **Pipeline React Query hooks** — usePipelineLeads, useAdvanceStage, useAddNote, useActivity | `client/src/lib/pipeline.ts` |
| 17 | `[ ]` | **Pipeline kanban** — 5-column (New→Contacted→Meeting→Proposal→Closed), drag between stages, add note modal | `client/src/routes/pipeline.tsx` |

> **Depends on:** Phase 1 (for companies). **Delivers:** Sales pipeline with stage tracking + activity log.

### Phase 4: AI Layer

| # | Check | Task | Files |
|---|-------|------|-------|
| 18 | `[ ]` | **AI enrichment** — LLM fills segment/domain/applications for companies | `services/ai/enrich.ts` |
| 19 | `[ ]` | **AI outreach** — LLM generates personalized cold email from signals + products | `services/ai/outreach.ts` |
| 20 | `[ ]` | **AI explainer + API** — LLM explains score breakdown, POST /enrich/:id, POST /outreach/:id, GET /explain/:id | `services/ai/explain.ts`, `routes/ai.ts` |
| 21 | `[ ]` | **AI UI** — "Enrich" / "Generate Email" / "Why this score?" buttons on lead detail drawer | `client/src/routes/leads/$id.tsx` |

> **Depends on:** Phase 1 + Phase 2 (for data + detail drawer). **Delivers:** AI-powered enrichment, outreach emails, score explanations.

### Phase 5: Verification

| # | Check | Task | Details |
|---|-------|------|---------|
| 22 | `[ ]` | **TypeScript + LSP** — `npm run typecheck` clean, no `lsp_diagnostics` errors on all new files | All changed files |
| 23 | `[ ]` | **Neo4j smoke test** — `docker compose up -d neo4j` → `npm run ingest:seed` → `npm run ingest` → `npm run score` → check API endpoints | Full pipeline |

---

## Dependency Flow

```
                     ┌─────────────────────────────────────┐
                     │  You: Ingestion Pipeline             │
                     │  Task 1-9: types → adapters →        │
                     │  SourceManager → seed → ingest →     │
                     │  score                                │
                     │                                       │
                     │  OUTPUT: Neo4j full of companies,     │
                     │  signals, scores, tiers               │
                     └─────────────────┬───────────────────┘
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
              ┌────────────────┐ ┌────────────┐ ┌──────────────┐
              │ Collab A       │ │ Collab B   │ │ Collab C     │
              │ Lead Dashboard │ │ Pipeline   │ │ AI Layer     │
              │                │ │ CRM        │ │              │
              │ Reads from     │ │ Reads AND  │ │ Reads AND    │
              │ Neo4j via API  │ │ writes to  │ │ writes to    │
              │ (read-only)    │ │ Neo4j      │ │ Neo4j        │
              │                │ │            │ │              │
              │ Tasks A1-A5    │ │ Tasks B1-B5│ │ Tasks C1-C5  │
              └────────────────┘ └────────────┘ └──────────────┘
```

**Parallel execution:** All 3 collaborators can start as soon as the graph schema is known (YOU Task 2). Collaborator A needs scoring data (YOU Task 9) for full functionality but can build the UI with mock data first. Collaborators B and C are fully independent.

---

## Extended API Endpoints

| Method | Path | Description | Owner |
|--------|------|-------------|-------|
| POST | `/api/graph/seed` | Seed ontology + baseline companies | You |
| POST | `/api/graph/ingest` | Run all ingestion adapters (or `?source=fda-510k`) | You |
| GET | `/api/graph/score` | Score all prospects (HOT/WARM/COLD) | A |
| GET | `/api/graph/ingest/sources` | List registered adapters | You |
| GET | `/api/graph/health` | Neo4j connectivity check | — |
| POST | `/api/graph/query` | Execute arbitrary Cypher | — |
| POST | `/api/pipeline/start` | Start pipeline tracking for a lead | B |
| GET | `/api/pipeline/leads` | Get all pipeline leads with current stage | B |
| PUT | `/api/pipeline/:id/advance` | Advance to next pipeline stage | B |
| POST | `/api/pipeline/:id/notes` | Add activity note | B |
| GET | `/api/pipeline/:id/activity` | Get activity history | B |
| POST | `/api/ai/enrich/:companyId` | AI-enrich company data (segment, domain) | C |
| POST | `/api/ai/outreach/:companyId` | Generate personalized outreach email | C |
| GET | `/api/ai/explain/:companyId` | AI justification of score breakdown | C |
| POST | `/api/ai/ask` | General AI chat with graph context | — |
