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
| POST | `/api/graph/seed` | Seed ontology |
| POST | `/api/graph/ingest` | Run ingest (all or `?source=`) |
| POST | `/api/graph/ingest/status/:jobId` | Async ingest job progress |
| GET | `/api/graph/ingest/sources` | Registered adapters + health |
| GET | `/api/graph/score` | Score all prospects |
| GET | `/api/graph/stats` | Graph node/relationship counts |
| DELETE | `/api/graph/ingest` | Truncate graph |
| GET | `/api/pipeline/stages` | Pipeline stage definitions |
| GET | `/api/pipeline/leads` | All pipeline leads |
| POST | `/api/pipeline/start` | Start pipeline tracking |
| PUT | `/api/pipeline/:id/advance` | Advance to next stage |
| PUT | `/api/pipeline/:id/regress` | Move to any previous stage |
| POST | `/api/pipeline/:id/activity` | Add activity note |
| GET | `/api/pipeline/:id/activity` | Get activity history |
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
│  │  │  FDA=50 │ GitHub=40 │ ClinicalTrials=30 │ OpenAlex=28 │ EPatent=23  │    │   │
│  │  │  DRKS=22 │ Patent=25 │ Hiring=20 │ Medica=18 │ Foekat=15 │ Conf=15  │    │   │
│  │  │  Funding=10                                                       │    │   │
│  │  │                                                                   │    │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │    │   │
│  │  │  │FDA 510(k)│ │  GitHub  │ │ Clinical │ │ OpenAlex │ │  EPO   │  │    │   │
│  │  │  │  REAL    │ │  REAL    │ │  Trials  │ │  REAL    │ │  OPS   │  │    │   │
│  │  │  │          │ │          │ │  REAL    │ │ (pubs)   │ │ (pat.) │  │    │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘  │    │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │    │   │
│  │  │  │  DRKS    │ │  MEDICA  │ │  FÖKAT   │ │  4 Stubs │ │        │  │    │   │
│  │  │  │  REAL    │ │  REAL    │ │  REAL    │ │ (pat/hire │ │        │  │    │   │
│  │  │  │ (trials) │ │ (conf.)  │ │ (grants) │ │ /conf/fnd)│ │        │  │    │   │
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
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ api.fda.gov  │ │ api.github   │ │ clinicaltrials│ │ api.openalex │          │
│  │ /device/510k │ │ .com/search  │ │ .gov         │ │ .org/works   │          │
│  │ FDA 510(k)   │ │ Diagnostic   │ │ Clinical     │ │ Research     │          │
│  │ REAL ── 8    │ │ keyword org  │ │ Trials       │ │ publications │          │
│  │ product code │ │ detection    │ │ REAL (US)    │ │ REAL         │          │
│  │ filters      │ │ REAL         │ │              │ │              │          │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ drks.de      │ │ epo.org      │ │ medica-tradefair│ foerderportal │          │
│  │ /search/     │ │ /ops/restful │ │ .com/vis/v1  │ .bund.de/    │          │
│  │ download/all │ │ DE patents   │ │ Exhibitor DB │ foekat       │          │
│  │ DRKS (DE)    │ │ by IPC codes │ │ MEDICA (DE)  │ FÖKAT grants │          │
│  │ REAL (DACH)  │ │ REAL (DACH)  │ │ REAL (DACH)  │ REAL (DACH)  │          │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ Stub: Patent │ │ Stub: Hiring │ │ Stub: Conf.  │ │ Stub: Funding│          │
│  │ (fallback)   │ │ (fallback)   │ │ (fallback)   │ │ (fallback)   │          │
│  │ 5 simulated  │ │ 5 simulated  │ │ 5 simulated  │ │ 4 simulated  │          │
│  │ patent recs  │ │ R&D/QA roles │ │ exhibitor    │ │ VC/grant recs│          │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘          │
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
│  Env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY,                    │
│  GITHUB_TOKEN (opt), EPO_CONSUMER_KEY + EPO_CONSUMER_SECRET (opt)               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan (23 Tasks, 5 Phases)

> Full code for each task in [`docs/superpowers/plans/2026-06-05-leadgraph-comprehensive-plan.md`](docs/superpowers/plans/2026-06-05-leadgraph-comprehensive-plan.md)
>
> **Team Legend:**
> | Icon | Member | Role |
> |------|--------|------|
> | 🛠️ | **Tobias** | Backend Ingestion Pipeline |
> | 🎨 | **Reyyan** | Lead Dashboard UI |
> | 📋 | **Beyza** | Pipeline CRM |
> | 🤖 | **Zeynep** | AI Outreach & Scoring |
> | ✅ | Anyone | Verification |

### Phase 1: Backend Ingestion + Scoring (🛠️ Tobias)

| # | Check | Task | Owner | Files |
|---|-------|------|-------|-------|
| 1 | `[x]` | **queryRows helper** — add native-record Cypher helper to `neo4j.ts` for scorer | 🛠️ **Tobias** | `services/graph/neo4j.ts` |
| 2 | `[x]` | **Types** — SourceAdapter interface, SourceConfig, scoring types (TierLevel, ScoreBreakdown, ScoredCompany) | 🛠️ **Tobias** | `services/graph/ingest/types.ts` |
| 3 | `[x]` | **Ontology seed** — constraints, 7 applications, 10 Siemens products, 15 competitor companies, seed signals | 🛠️ **Tobias** | `services/graph/ingest/ontology.ts` |
| 4 | `[x]` | **4 stub adapters** — Patent, Hiring, Conference, Funding (hardcoded records → LeadCandidate) | 🛠️ **Tobias** | `services/graph/ingest/adapters/*-stub.ts` |
| 5 | `[x]` | **FDA adapter** — real `api.fda.gov/device/510k` with 8 product code filters, company extraction | 🛠️ **Tobias** | `services/graph/ingest/adapters/fda-510k.ts` |
| 6 | `[x]` | **GitHub adapter** — real `api.github.com` keyword search, org detection, topic→application mapping | 🛠️ **Tobias** | `services/graph/ingest/adapters/github.ts` |
| 7 | `[x]` | **SourceManager** — concurrent runner, pool=3, weight-sorted, dedup, Neo4j upsert | 🛠️ **Tobias** | `services/graph/ingest/orchestrator.ts` |
| 8 | `[x]` | **Index + routes** — singleton SourceManager with all adapters, POST /ingest, GET /sources, job tracker | 🛠️ **Tobias** | `ingest/index.ts`, `routes/graph.ts` |
| 9 | `[x]` | **CLI + Scoring** — `npm run ingest`, `npm run score`. Scorer computes signal (0-40) + product fit (0-30) + segment bonus (0-20) + recency (0-10) → HOT/WARM/COLD | 🛠️ **Tobias** | `scripts/ingest.ts`, `scoring/scorer.ts` |

> **Delivers:** Neo4j populated with companies, signals, scores.

### Phase 1.5: DACH Market Data Sources (🛠️ Tobias)

| # | Check | Task | Owner | Files |
|---|-------|------|-------|-------|
| 10 | `[x]` | **ClinicalTrials adapter** — real `clinicaltrials.gov` API, CLINICAL_TRIAL signal, shared app area extraction | 🛠️ **Tobias** | `adapters/clinical-trials.ts` |
| 11 | `[x]` | **OpenAlex adapter** — real `api.openalex.org` research publications, company-affiliated authors | 🛠️ **Tobias** | `adapters/openalex.ts` |
| 12 | `[x]` | **DRKS adapter** — German Clinical Trials Register bulk JSON download, CLINICAL_TRIAL signal (weight 22) | 🛠️ **Tobias** | `adapters/drks.ts` |
| 13 | `[x]` | **EPO OPS adapter** — European Patent Office OAuth2 API, DE patents by IPC codes, PATENT signal (weight 23) | 🛠️ **Tobias** | `adapters/epatent.ts` |
| 14 | `[x]` | **MEDICA adapter** — exhibitor database via /vis/v1/ HTML scraping, CONFERENCE signal (weight 18) | 🛠️ **Tobias** | `adapters/medica.ts` |
| 15 | `[x]` | **BMBF FÖKAT adapter** — CSV export of German funded research projects, FUNDING signal (weight 15) | 🛠️ **Tobias** | `adapters/foekat.ts` |
| 16 | `[x]` | **Job tracker** — in-memory Map for async ingest job progress tracking | 🛠️ **Tobias** | `job-tracker.ts` |

> **Delivers:** 12 adapters (8 real, 4 stubs). DACH-region coverage with DRKS, EPO, MEDICA, FÖKAT.

### Phase 2: Dashboard UI (🎨 Reyyan)

| # | Check | Task | Owner | Files |
|---|-------|------|-------|-------|
| 17 | `[ ]` | **API hooks** — useIngest, useSeed, useScores, useSources in TanStack Query | 🎨 **Reyyan** | `client/src/lib/graph.ts` |
| 18 | `[ ]` | **Navigation** — add Leads, Pipeline, Admin links to RootLayout | 🎨 **Reyyan** | `client/src/routes/__root.tsx` |
| 19 | `[ ]` | **Dashboard home** — 4 summary cards, Top 5 leads, Quick Actions (Seed/Ingest buttons) | 🎨 **Reyyan** | `client/src/routes/index.tsx` |
| 20 | `[ ]` | **Lead Explorer** — score-sorted table with tier badges + score bars, search/filter, detail drawer with signals timeline + breakdown + outreach hook | 🎨 **Reyyan** | `client/src/routes/leads*.tsx` |
| 21 | `[ ]` | **Admin panel** — per-source Run buttons, health status, scoring summary, Neo4j stats | 🎨 **Reyyan** | `client/src/routes/admin.tsx` |

> **Depends on:** Phase 1 (for data), but buildable with mock data. **Delivers:** Full UI to browse/explore scored leads.

### Phase 3: Pipeline CRM (📋 Beyza — Implemented)

| # | Check | Task | Owner | Files |
|---|-------|------|-------|-------|
| 22 | `[x]` | **Pipeline data model + API** — Contact/PipelineStage/Activity Cypher, POST start, PUT advance, PUT regress, GET leads, POST notes | 📋 **Beyza** | `services/graph/pipeline/`, `routes/pipeline.ts` |
| 23 | `[x]` | **Pipeline React Query hooks** — usePipelineLeads, useAdvanceStage, useRegressStage, useAddActivity, useContactActivity | 📋 **Beyza** | `client/src/lib/pipeline.ts` |
| 24 | `[x]` | **Pipeline kanban** — 6-column (New→Contacted→Meeting→Proposal→Closed Won→Closed Lost), advance/regress, activity timeline, add notes | 📋 **Beyza** | `client/src/routes/pipeline.tsx` |

> **Delivers:** Real Neo4j-backed pipeline with kanban UI, activity tracking, stage transitions.

### Phase 4: AI Layer (🤖 Zeynep)

| # | Check | Task | Owner | Files |
|---|-------|------|-------|-------|
| 25 | `[ ]` | **AI enrichment** — LLM fills segment/domain/applications for companies | 🤖 **Zeynep** | `services/ai/enrich.ts` |
| 26 | `[ ]` | **AI outreach** — LLM generates personalized cold email from signals + products | 🤖 **Zeynep** | `services/ai/outreach.ts` |
| 27 | `[ ]` | **AI explainer + API** — LLM explains score breakdown, POST /enrich/:id, POST /outreach/:id, GET /explain/:id | 🤖 **Zeynep** | `services/ai/explain.ts`, `routes/ai.ts` |
| 28 | `[ ]` | **AI UI** — "Enrich" / "Generate Email" / "Why this score?" buttons on lead detail drawer | 🤖 **Zeynep** | `client/src/routes/leads/$id.tsx` |

> **Depends on:** Phase 2 (for detail drawer). **Delivers:** AI-powered enrichment, outreach emails, score explanations.

### Phase 5: Verification (✅ All)

| # | Check | Task | Owner | Details |
|---|-------|------|-------|---------|
| 29 | `[ ]` | **TypeScript + LSP** — `npm run typecheck` clean, no `lsp_diagnostics` errors on all new files | ✅ Anyone | All changed files |
| 30 | `[ ]` | **Neo4j smoke test** — `docker compose up -d neo4j` → `npm run ingest:seed` → `npm run ingest` → `npm run score` → check API endpoints | ✅ Anyone | Full pipeline |

---

## Team Member Overview

| Member | Focus | Tasks | What They Build |
|--------|-------|-------|-----------------|
| 🛠️ **Tobias** | Ingestion Pipeline | 1–16 | Types, ontology, 12 data source adapters (8 real: FDA, GitHub, ClinicalTrials, OpenAlex, DRKS, EPO, MEDICA, FÖKAT + 4 stubs), concurrent SourceManager, job tracker, Neo4j upsert, scoring pipeline, CLI scripts, pipeline backend |
| 🎨 **Reyyan** | Lead Dashboard UI | 17–21 | React pages: Dashboard home with summary cards, Lead Explorer table with filters + detail drawer, Admin panel with ingest controls. Uses TanStack Router/Query |
| 📋 **Beyza** | Pipeline CRM | 22–24 | Neo4j pipeline data model (Contact/Stage/Activity), CRUD API, React kanban board with advance/regress, activity timeline, note-taking |
| 🤖 **Zeynep** | AI Layer | 25–28 | Company enrichment (LLM fills missing data), personalized outreach email generator, score explainer, UI integration with buttons on lead detail drawer |

## Dependency Flow

```
                           ┌─────────────────────────────────────┐
                           │ 🛠️ **Tobias**: Backend Pipeline           │
                           │ Tasks 1-16: types → adapters (8     │
                           │ real + 4 stubs) → SourceManager →   │
                           │ seed → ingest → score → pipeline    │
                           │                                      │
                           │ OUTPUT: Neo4j full of companies,      │
                           │ signals, scores, tiers, pipeline      │
                           └─────────────────┬───────────────────┘
                                             │
                             ┌───────────────┼───────────────┐
                             ▼               ▼               ▼
                    ┌────────────────┐ ┌────────────┐ ┌──────────────┐
                    │ 🎨 **Reyyan**    │ │ 📋 **Beyza**│ │ 🤖 **Zeynep**  │
                    │ Lead Dashboard │ │ Pipeline   │ │ AI Layer     │
                    │                │ │ CRM        │ │              │
                    │ Tasks 17-21    │ │ Tasks 22-24│ │ Tasks 25-28  │
                    │ Reads from     │ │ Extends &  │ │ Builds new   │
                    │ Neo4j via API  │ │ enhances   │ │ services on  │
                    │ (read-only)    │ │ existing   │ │ existing     │
                    │                │ │ kanban +   │ │ graph data    │
                    │                │ │ hooks      │ │              │
                    └────────────────┘ └────────────┘ └──────────────┘
```

**All backend infrastructure is complete.** 🎨 **Reyyan** (Dashboard UI) and 🤖 **Zeynep** (AI layer) can work in parallel — Reyyan needs to build API hooks + routes, Zeynep needs backend AI services + frontend buttons. 📋 **Beyza** can skip ahead to enhancing the pipeline (add drag-and-drop, email notifications, etc.).

---

## Extended API Endpoints

| Method | Path | Description | Owner |
|--------|------|-------------|-------|
| POST | `/api/graph/seed` | Seed ontology + baseline companies | ✅ Done |
| GET | `/api/graph/health` | Neo4j connectivity check | ✅ Done |
| POST | `/api/graph/query` | Execute arbitrary Cypher | ✅ Done |
| GET | `/api/graph/stats` | Graph node/relationship counts | ✅ Done |
| POST | `/api/graph/ingest` | Run all ingestion adapters (or `?source=`) | ✅ Done |
| POST | `/api/graph/ingest/status/:jobId` | Async ingest job progress | ✅ Done |
| GET | `/api/graph/ingest/sources` | List registered adapters + health | ✅ Done |
| DELETE | `/api/graph/ingest` | Truncate graph | ✅ Done |
| GET | `/api/graph/score` | Score all prospects (HOT/WARM/COLD) | ✅ Done |
| GET | `/api/pipeline/stages` | Pipeline stage definitions | ✅ Done |
| GET | `/api/pipeline/leads` | All pipeline leads with current stage | ✅ Done |
| POST | `/api/pipeline/start` | Start pipeline tracking for a lead | ✅ Done |
| PUT | `/api/pipeline/:id/advance` | Advance to next pipeline stage | ✅ Done |
| PUT | `/api/pipeline/:id/regress` | Move to any previous stage | ✅ Done |
| POST | `/api/pipeline/:id/activity` | Add activity note | ✅ Done |
| GET | `/api/pipeline/:id/activity` | Get activity history | ✅ Done |
| POST | `/api/ai/enrich/:companyId` | AI-enrich company data (segment, domain) | 🤖 Zeynep |
| POST | `/api/ai/outreach/:companyId` | Generate personalized outreach email | 🤖 Zeynep |
| GET | `/api/ai/explain/:companyId` | AI justification of score breakdown | 🤖 Zeynep |
| POST | `/api/ai/ask` | General AI chat with graph context | ✅ Done |
