# LeadGraph — Global Adapter Roadmap

> **Goal:** Expand data ingestion beyond US/EU sources to cover medical device companies worldwide, increasing lead coverage from ~1,300 to 20,000+ companies.

## Current State (16 adapters, Tier 1 ✅)

| Adapter | Type | Coverage | Companies |
|---------|------|----------|-----------|
| FDA 510(k) | REST API | US | ~200 |
| ClinicalTrials.gov | REST API | US/EU | ~200 |
| OpenAlex | REST API | Global (research) | ~300 |
| DRKS (German trials) | REST API | Germany | ~50 |
| EPatent (EPO) | REST API | Europe | ~200 (requires EPO_CONSUMER_KEY) |
| GitHub | REST API | Global (dev) | ~100 (requires GITHUB_TOKEN) |
| Medica | Web scrape | Trade fair | ~50 |
| Foekat (German hospitals) | Web scrape | Germany | ~30 |
| **Canada MDALL** | REST API | Canada | ~2,000+ |
| **South Korea MFDS** | REST API | South Korea | ~3,000+ |
| **Australia TGA ARTG** | REST API | Australia | ~3,000+ |
| **China NMPA** | REST API | China | ~5,000+ |
| PatentStub | Stub | — | — |
| HiringStub | Stub | — | — |
| ConferenceStub | Stub | — | — |
| FundingStub | Stub | — | — |

**Total: ~14,285 companies potential. Tier 1 adapters registered but require API keys (MFDS, NMPA) to fetch. EPatent and GitHub adapters also need env keys.**

---

## Tier 1 — Open APIs, Quick Wins (Sprint 1) ✅ DONE

| # | Source | Region | Est. Companies | Status |
|---|--------|--------|---------------|--------|
| 1 | **Canada MDALL** | Canada | 2,000+ | ✅ Implemented — no auth needed |
| 2 | **South Korea MFDS** | South Korea | 3,000+ | ✅ Implemented — needs MFDS_API_KEY |
| 3 | **Australia TGA ARTG** | Australia | 3,000+ | ✅ Implemented — no auth needed |
| 4 | **China NMPA** | China | 5,000+ | ✅ Implemented — needs NMPA_API_KEY |

---

## Tier 2 — Replace Stubs with Real Sources (Sprint 2)

Replace the 4 stub adapters (PatentStub, HiringStub, ConferenceStub, FundingStub) with real API-based sources. Add two major cross-region sources.

| # | Source | Region | Est. Companies | API Type | Replaces |
|---|--------|--------|---------------|----------|----------|
| 5 | **Crunchbase** | Global | 5,000+ | REST API (free tier) | FundingStub |
| 6 | **Google Patents** | Global | 5,000+ | REST API (free) | PatentStub |
| 7 | **LinkedIn / Indeed Jobs API** | Global | 3,000+ | RapidAPI / indeed-scraper | HiringStub |
| 8 | **Trade Fair Scraper** (MEDICA, Arab Health, etc.) | Global | 1,000+ | Web scraping | ConferenceStub |

**Est. total Tier 2: 14,000+ companies**

---

## Tier 3 — Higher Effort, Specialized Sources (Sprint 3+)

These require scraping, M2M approval processes, or custom data processing.

| # | Source | Region | Est. Companies | Complexity |
|---|--------|--------|---------------|------------|
| 9 | **ANVISA** (Brazilian Health Regulator) | Brazil | 2,000+ | Web scraping (Portuguese) |
| 10 | **EUDAMED** (European Medical Device Database) | EU | 5,000+ | M2M registration, Actor API |
| 11 | **WHO Prequalification** | Global (procurement) | 500+ | Scraping |
| 12 | **Japan PMDA** | Japan | 2,000+ | Data mining |
| 13 | **India CDSCO** | India | 3,000+ | Scraping, CAPTCHA |

**Est. total Tier 3: 12,500+ companies**

---

## Quick Wins (Zero Code Changes)

| Action | Effect |
|--------|--------|
| Add `GITHUB_TOKEN` to `.env.production` | Unlocks existing GitHub adapter (100+ companies) |
| Add `EPO_CONSUMER_KEY` to `.env.production` | Unlocks existing EPatent adapter (200+ companies) |

---

## Cumulative Coverage Projection

```
Sprint 0 (current):   1,285 companies  ─── US/EU only
Sprint 1 (Tier 1):   14,000+            ✅ MDALL + MFDS + ARTG + NMPA (implemented, pending env keys)
Sprint 2 (Tier 2):   25,000+            Crunchbase + Patents + Jobs + Fairs
Sprint 3 (Tier 3):   35,000+            ANVISA + EUDAMED + PMDA + CDSCO + WHO
```

Each sprint builds, deploys, and scores independently — adapters layer on top of existing data without re-ingestion.

---

## Architecture Note

All adapters implement the `SourceAdapter` interface:
```typescript
interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  fetch(): Promise<RawLead[]>;
  normalize(raw: RawLead): LeadCandidate;
  healthCheck(): Promise<boolean>;
}
```

Registration in `packages/server/src/services/graph/ingest/index.ts`:
```typescript
managerInstance.register(new MyNewAdapter(), { weight: 25 });
```

No changes needed to the orchestrator, deduplication logic, or Neo4j schema.
