# Gi-Hack — AI Graph TanStack Boilerplate

[![CI](https://github.com/tobias-weiss-ai-xr/gi-hack/actions/workflows/ci.yml/badge.svg)](https://github.com/tobias-weiss-ai-xr/gi-hack/actions/workflows/ci.yml)
[![Deploy](https://github.com/tobias-weiss-ai-xr/gi-hack/actions/workflows/deploy.yml/badge.svg)](https://github.com/tobias-weiss-ai-xr/gi-hack/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Neo4j](https://img.shields.io/badge/Neo4j-5-008CC1?logo=neo4j&logoColor=white)](https://neo4j.com)
[![Last commit](https://img.shields.io/github/last-commit/tobias-weiss-ai-xr/gi-hack)](https://github.com/tobias-weiss-ai-xr/gi-hack/commits/main)

![LeadGraph Teaser](docs/teaser.png)

A ready-to-hack boilerplate for the **StartMiUp Hackathon – AI for Mittelhessen**.

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS v4 |
| Backend | Express + TypeScript (tsx watch) |
| Graph DB | Neo4j 5 Community + APOC (Docker) |
| AI | Vercel AI SDK (OpenAI, swappable) |

---

## Quick Start

**Prerequisites:** Node.js 20+, Docker, npm

```bash
# 1. Start Neo4j
docker compose up -d neo4j

# 2. Configure environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY (optional, for AI features)

# 3. Install dependencies
npm install

# 4. Build server (required for demo script)
npm -w packages/server run build

# 5. Load demo pipeline data
npm run demo:pipeline

# 6. Start development
npm run dev
```

Open **http://localhost:5173** — client on :5173, server on :3001, Neo4j Browser on :7474.

**Database Options:**
| Option | Command | What you get |
|--------|---------|-------------|
| **Demo Pipeline** | `npm run demo:pipeline` | 10 demo CRM leads across all pipeline stages (57 activities) |
| **Bootstrap** (fastest) | `docker compose --profile bootstrap run bootstrap` | 1,300 companies, 1,800 signals, scored leads |
| **Live ingest** | `npm run ingest:seed` | Fresh data from 8 real API sources |
| **Empty** | Start without step 2 | Base ontology via `/api/graph/seed` |

---

## Data

### Bootstrap (pre-built snapshot)

```bash
# Load data
docker compose up -d neo4j
docker compose --profile bootstrap run bootstrap   # Recommended
# or: npm run db:bootstrap

# Re-snapshot current DB state
npm run db:export                # Generates packages/server/db/bootstrap.cypher

# Reset and reload
docker compose down -v && docker compose up -d neo4j && npm run db:bootstrap
```

Bootstrap executes 4,765+ idempotent Cypher statements creating constraints, ontology, companies, signals, and relationships.

### Live Ingestion (fresh data from APIs)

```bash
# Seed ontology + run all adapters + score
npm run ingest:seed

# Or step by step:
curl -X POST http://localhost:3001/api/graph/seed          # Ontology
npm run ingest                                              # All 12 adapters
npm run score                                               # Compute HOT/WARM/COLD
```

| Source | Type | Signal | Auth |
|--------|------|--------|------|
| FDA 510(k) | Real API | FDA_CLEARANCE | None |
| GitHub | Real API | GITHUB_ACTIVITY | Token (opt) |
| ClinicalTrials.gov | Real API | CLINICAL_TRIAL | None |
| OpenAlex | Real API | RESEARCH_PUBLICATION | None |
| DRKS (DE) | Real API | CLINICAL_TRIAL | None |
| EPO OPS (EP) | Real API | PATENT | OAuth2 (free reg.) |
| MEDICA (DE) | Scrape | CONFERENCE | None |
| BMBF FÖKAT (DE) | CSV export | FUNDING | None |
| 4 stubs | Simulated | Patent/Hiring/Conf./Funding | None |

### Scoring

```
Signal Score (0-40) + Product Fit (0-30) + Segment Bonus (0-20) + Recency Bonus (0-10)
→ Total (0-100) → Tier: HOT ≥ 70 / WARM ≥ 40 / COLD < 40
```

---

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
│   │       └── services/# Neo4j + AI + pipeline services
│   └── shared/          # TypeScript types
├── docker-compose.yml   # Neo4j service
├── .env.example         # Config template
└── docs/                # Design docs, architecture diagrams
```

---

## API Reference

### Graph & Ingestion
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/graph/health` | Neo4j connectivity check |
| POST | `/api/graph/seed` | Seed ontology (applications, products, companies) |
| POST | `/api/graph/ingest` | Run live ingestion (all or `?source=`) |
| POST | `/api/graph/ingest/status/:jobId` | Async ingest job progress |
| GET | `/api/graph/ingest/sources` | Registered adapters + health |
| GET | `/api/graph/score` | Score all prospects (HOT/WARM/COLD) |
| GET | `/api/graph/stats` | Node/relationship counts |
| DELETE | `/api/graph/ingest` | Truncate graph |
| POST | `/api/graph/query` | Execute arbitrary Cypher |

### Pipeline CRM
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pipeline/stages` | Stage definitions |
| GET | `/api/pipeline/leads` | All pipeline leads |
| POST | `/api/pipeline/start` | Start pipeline tracking |
| PUT | `/api/pipeline/:id/advance` | Advance to next stage |
| PUT | `/api/pipeline/:id/regress` | Move to any stage |
| POST | `/api/pipeline/:id/activity` | Add activity note |
| GET | `/api/pipeline/:id/activity` | Activity history |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/ask` | Chat with graph context |
| POST | `/api/ai/enrich/:companyId` | AI enrichment (segment, domain) |
| POST | `/api/ai/outreach/:companyId` | Generate outreach email |
| GET | `/api/ai/explain/:companyId` | Score breakdown explanation |

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture diagram (frontend → API → Neo4j → data sources), node/edge model, data flow, and component design.

Scoring algorithm: [`docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md`](docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md)

---

## Implementation Status

| Phase | What | Who | Status |
|-------|------|-----|--------|
| **1** | Backend: ingest pipeline, scoring, 4 stubs + 4 real adapters | 🛠️ Tobias | ✅ Done |
| **1.5** | DACH sources: DRKS, EPO OPS, MEDICA, FÖKAT + ClinicalTrials, OpenAlex | 🛠️ Tobias | ✅ Done |
| **2** | Dashboard: API hooks ✅, Nav ✅, Lead Explorer ✅, Admin ✅, HomePage ❌, LeadDetail ❌ | 🎨 Reyyan | ⏳ Partial (4/6 done) |
| **3** | Pipeline CRM: data model, API, kanban, hooks | 📋 Beyza | ✅ Done |
| **4** | AI layer: enrichment, outreach, explain services & routes ✅, UI ❌ | 🤖 Zeynep | ⏳ Services done, UI pending |
| **5** | Verification: typecheck ❌, smoke test ❌ | ✅ All | ❌ TS errors |

**Known gaps:**
- Client typecheck: pipeline.tsx imports don't match hooks file (~20 errors)
- Server typecheck: 2 unused vars in export-bootstrap.ts
- Pre-built bootstrap.cypher may be stale — run `npm run db:export` to refresh

**Team:**
| Member | Role | Tasks |
|--------|------|-------|
| 🛠️ **Tobias** | Backend Pipeline | 1–16 (all backend infra, 12 adapters, scoring, pipeline) |
| 🎨 **Reyyan** | Dashboard UI | 17–21 (home, Lead Explorer, Admin — TanStack) |
| 📋 **Beyza** | Pipeline CRM | 22–24 (Neo4j model, API, kanban) |
| 🤖 **Zeynep** | AI Layer | 25–28 (enrich, outreach, explain — services done + API routes) |

---

## LeadGraph — Siemens Healthineers Challenge

**Problem:** Siemens Healthineers produces biological intermediates (proteins, antibodies, latex particles, blockers) at Marburg but lacks a B2B sales structure to identify buyers.

**Solution:** Neo4j knowledge graph + AI lead scoring that discovers, ranks, and surfaces diagnostic companies developing new assays.

See the full spec at [`docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md`](docs/superpowers/specs/2026-06-05-leadgraph-ingestion-design.md)

---

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `NEO4J_URI` | No | `bolt://localhost:7687` |
| `NEO4J_USER` | No | `neo4j` |
| `NEO4J_PASSWORD` | No | `password` |
| `OPENAI_API_KEY` | For AI features | — |
| `GITHUB_TOKEN` | For GitHub adapter | — (works with lower rate limit) |
| `EPO_CONSUMER_KEY` | For EPO OPS adapter | — |
| `EPO_CONSUMER_SECRET` | For EPO OPS adapter | — |
