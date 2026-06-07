# Tier 1 Adapter Implementation Plan — Canada MDALL, Korea MFDS, Australia TGA, China NMPA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 production-grade data ingestion adapters for global medical device regulatory databases (Canada, South Korea, Australia, China) to expand lead coverage from ~1,285 to ~14,000+ companies.

**Architecture:** Each adapter implements the `SourceAdapter` interface (fetch → normalize → healthCheck). Registered in the `SourceManager` pool in `ingest/index.ts`. Adapters fetch from external REST APIs or parse bulk CSVs, transform to `RawLead[]` → normalize to `LeadCandidate[]` with `Signal` objects. Existing dedup by `normalizedName` and `mergeSignals` handles cross-source merging automatically.

**Tech Stack:** TypeScript, `fetch()` (Node 22 built-in), `AbortSignal.timeout()`, same pattern as `fda-510k.ts` / `openalex.ts`. No new npm deps needed. Tests use vitest with mocked fetch.

**Existing patterns to follow:**
- `packages/server/src/services/graph/ingest/types.ts` — `SourceAdapter`, `RawLead`, `LeadCandidate`, `Signal`, `SignalType`
- `packages/server/src/services/graph/ingest/adapters/fda-510k.ts` — reference adapter (60-line fetch, 30-line normalize, 15-line healthCheck)
- `packages/server/src/services/graph/ingest/orchestrator.ts` — `normalizeCompanyName()`, cross-source dedup
- `packages/server/src/services/graph/ingest/index.ts` — adapter registration via `managerInstance.register()`

---

## File Structure

### Created:
- `packages/server/src/services/graph/ingest/adapters/mdall.ts` — Canada MDALL adapter
- `packages/server/src/services/graph/ingest/adapters/mfds.ts` — South Korea MFDS adapter
- `packages/server/src/services/graph/ingest/adapters/tga.ts` — Australia TGA ARTG adapter
- `packages/server/src/services/graph/ingest/adapters/nmpa.ts` — China NMPA adapter
- `tests/unit/graph/mdall.test.ts` — MDALL tests
- `tests/unit/graph/mfds.test.ts` — MFDS tests
- `tests/unit/graph/tga.test.ts` — TGA tests
- `tests/unit/graph/nmpa.test.ts` — NMPA tests

### Modified:
- `packages/server/src/services/graph/ingest/index.ts` — import + register 4 new adapters
- `.env.example` — document new env vars (MFDS_API_KEY, NMPA_API_KEY)
- `packages/server/src/services/graph/ingest/types.ts` — add `MDALL_CLEARANCE`, `MFDS_CLEARANCE`, `TGA_CLEARANCE`, `NMPA_CLEARANCE` to `SignalType`

### Unchanged:
- `orchestrator.ts` — dedup, normalizeCompanyName, upsertCompany — works for any adapter
- routes/graph.ts — `POST /ingest` already calls `SourceManager.runAll()`
- Dockerfile — no new deps needed
- docker-compose — no new services needed

---

### Task 1: Extend SignalType with new clearance types

**Files:**
- Modify: `packages/server/src/services/graph/ingest/types.ts:33-41`

- [ ] **Step 1: Add new signal types**

Edit `types.ts`, add to the `SignalType` union:

```typescript
export type SignalType =
  | "FDA_CLEARANCE"
  | "CLINICAL_TRIAL"
  | "PATENT"
  | "HIRING"
  | "FUNDING"
  | "CONFERENCE"
  | "NEWS"
  | "RESEARCH_PUBLICATION"
  | "MDALL_CLEARANCE"
  | "MFDS_CLEARANCE"
  | "TGA_CLEARANCE"
  | "NMPA_CLEARANCE";
```

- [ ] **Step 2: Verify build and tests**

```bash
npm -w packages/server run build
npm -w packages/server run test
```

Expected: build passes, all 138+ existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/services/graph/ingest/types.ts
git commit -m "feat: add MDALL/MFDS/TGA/NMPA signal types for global adapters"
```

---

### Task 2: Canada MDALL Adapter

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/mdall.ts`
- Test: `tests/unit/graph/mdall.test.ts`

**API Details:** Health Canada MDALL API — `https://health-products.canada.ca/api/medical-devices/` — REST, no auth, JSON.

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/graph/mdall.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MDALLAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/mdall.js";

describe("MDALLAdapter", () => {
  let adapter: MDALLAdapter;

  beforeEach(() => {
    adapter = new MDALLAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("mdall");
    expect(adapter.name).toContain("Canada");
  });

  it("should return empty on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should normalize a raw lead correctly", () => {
    const raw = {
      sourceId: "mdall-123",
      sourceUrl: "https://health-products.canada.ca/mdall-licence/123",
      raw: {
        company_name: "Test Diagnostics Inc.",
        licence_name: "COVID-19 Test Kit",
        licence_number: "12345",
        status: "ACTIVE",
        issue_date: "2024-01-15",
        device_identifier: "DEV-001",
        licence_type: "Medical Device Licence",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.companyName).toBe("Test Diagnostics Inc.");
    expect(result.signals.length).toBe(1);
    expect(result.signals[0].type).toBe("MDALL_CLEARANCE");
    expect(result.applicationAreas).toContain("Infectious Disease & Serology");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/graph/mdall.test.ts --reporter=verbose
```

Expected: FAIL — "MDALLAdapter is not defined".

- [ ] **Step 3: Write the MDALL adapter**

```typescript
// packages/server/src/services/graph/ingest/adapters/mdall.ts
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const MDALL_API = "https://health-products.canada.ca/api/medical-devices/licences";

// Product categories relevant to in-vitro diagnostics
const CATEGORY_FILTERS = [
  { keyword: "diagnostic", application: "Infectious Disease & Serology" },
  { keyword: "assay", application: "Specialty Proteins & Reagents" },
  { keyword: "reagent", application: "Specialty Proteins & Reagents" },
  { keyword: "test kit", application: "Infectious Disease & Serology" },
  { keyword: "analyzer", application: "Point of Care" },
  { keyword: "immunoassay", application: "Autoimmune Diagnostics" },
  { keyword: "tumor marker", application: "Oncology & Tumor Markers" },
  { keyword: "cardiac", application: "Cardiac Markers" },
  { keyword: "coagulation", application: "Hemostasis & Thrombosis" },
];

interface MDALLResult {
  licence_number: string;
  company_name: string;
  company_address?: string;
  company_province?: string;
  licence_name: string;
  licence_type: string;
  status: string;
  issue_date: string;
  expiry_date?: string;
  device_identifier?: string;
  device_name?: string;
  manufacturer_name?: string;
}

interface MDALLResponse {
  results: MDALLResult[];
  total?: number;
}

async function fetchLicences(keyword: string): Promise<MDALLResult[]> {
  try {
    const url = `${MDALL_API}?keyword=${encodeURIComponent(keyword)}&status=ACTIVE&limit=100`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as MDALLResult[];
    // API returns array directly
    return Array.isArray(data) ? data : (data as MDALLResponse).results ?? [];
  } catch {
    return [];
  }
}

function classifyApplication(name: string): string {
  const lower = name.toLowerCase();
  if (/immunoassay|elisa|serolog|infectious|antibody|antigen|pathogen|virus|bacterial/.test(lower))
    return "Infectious Disease & Serology";
  if (/tumor|cancer|oncology|biomarker/.test(lower))
    return "Oncology & Tumor Markers";
  if (/cardiac|heart|troponin/.test(lower))
    return "Cardiac Markers";
  if (/coagulation|hemostasis|thrombosis|clotting/.test(lower))
    return "Hemostasis & Thrombosis";
  if (/autoimmune|rheumat|lupus|celiac/.test(lower))
    return "Autoimmune Diagnostics";
  if (/point.of.care|rapid|lateral.flow/.test(lower))
    return "Point of Care";
  return "Infectious Disease & Serology"; // default
}

export class MDALLAdapter implements SourceAdapter {
  readonly id = "mdall";
  readonly name = "Canada MDALL";
  readonly description = "Health Canada Medical Devices Active Licence Listing — licensed medical device companies";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenLicences = new Set<string>();

    for (const filter of CATEGORY_FILTERS) {
      const licences = await fetchLicences(filter.keyword);
      for (const licence of licences) {
        if (seenLicences.has(licence.licence_number)) continue;
        seenLicences.add(licence.licence_number);
        if (!licence.company_name) continue;

        allLeads.push({
          sourceId: `mdall-${licence.licence_number}`,
          sourceUrl: `https://health-products.canada.ca/mdall-licence/${licence.licence_number}`,
          raw: {
            ...licence,
            _assignedApplication: filter.application,
          } as unknown as Record<string, unknown>,
        });
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.company_name as string;
    const licenceName = r.licence_name as string;
    const issueDate = r.issue_date as string;
    const assignedApp = r._assignedApplication as string;
    const deviceName = r.device_name as string;
    const manufacturer = r.manufacturer_name as string;

    const appArea = deviceName
      ? classifyApplication(deviceName)
      : classifyApplication(licenceName);

    const signals: Signal[] = [
      {
        type: "MDALL_CLEARANCE",
        date: issueDate || new Date().toISOString().slice(0, 10),
        confidence: 0.85,
        description: `Canada MDALL: ${licenceName}${deviceName ? ` — ${deviceName}` : ""}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      description: `Canada medical device licence for ${assignedApp || appArea}`,
      applicationAreas: [appArea],
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${MDALL_API}?keyword=diagnostic&limit=1`, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/graph/mdall.test.ts --reporter=verbose
```

Expected: PASS (all tests without Neo4j dependency).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/mdall.ts tests/unit/graph/mdall.test.ts
git commit -m "feat: add Canada MDALL adapter for medical device licences"
```

---

### Task 3: South Korea MFDS Adapter

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/mfds.ts`
- Test: `tests/unit/graph/mfds.test.ts`

**API Details:** Korea MFDS (Ministry of Food and Drug Safety) — open API portal at `https://www.mfds.go.kr/eng/`. Uses `OPENAPI` key system. Base: `https://apis.data.go.kr/1471000/`.

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/graph/mfds.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MFDSAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/mfds.js";

describe("MFDSAdapter", () => {
  let adapter: MFDSAdapter;

  beforeEach(() => {
    adapter = new MFDSAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("mfds");
    expect(adapter.name).toContain("Korea");
  });

  it("should return empty on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should use MFDS_API_KEY from env", () => {
    process.env.MFDS_API_KEY = "test-key";
    const a = new MFDSAdapter();
    expect((a as any).apiKey).toBe("test-key");
  });

  it("should normalize a raw lead", () => {
    const raw = {
      sourceId: "mfds-K-12345",
      sourceUrl: "https://www.mfds.go.kr/eng/device/12345",
      raw: {
        companyName: "Samsung Medison Co. Ltd.",
        deviceName: "Ultrasound Diagnostic System",
        itemName: "RS85 Prestige",
        approvalDate: "2024-03-20",
        classification: "Class II",
        applicationArea: "Cardiac Markers",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.signals[0].type).toBe("MFDS_CLEARANCE");
    expect(result.applicationAreas).toContain("Cardiac Markers");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/unit/graph/mfds.test.ts --reporter=verbose
```

Expected: FAIL.

- [ ] **Step 3: Write the MFDS adapter**

```typescript
// packages/server/src/services/graph/ingest/adapters/mfds.ts
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const MFDS_BASE = "https://apis.data.go.kr/1471000";

// Device categories for MFDS medical device approvals
const DEVICE_CATEGORIES = [
  { code: "B040", application: "Infectious Disease & Serology", desc: "Diagnostic reagents" },
  { code: "B050", application: "Oncology & Tumor Markers", desc: "Cancer diagnostic devices" },
  { code: "B060", application: "Cardiac Markers", desc: "Cardiovascular diagnostic devices" },
  { code: "B070", application: "Point of Care", desc: "Point-of-care testing devices" },
  { code: "B080", application: "Autoimmune Diagnostics", desc: "Autoimmune diagnostic reagents" },
  { code: "B090", application: "Hemostasis & Thrombosis", desc: "Coagulation diagnostic devices" },
];

interface MFDSItem {
  itemName: string;
  itemSeq: string;
  deviceName?: string;
  companyName?: string;
  manufacturerName?: string;
  approvalDate?: string;
  classification?: string;
  etcString?: string;
}

interface MFDSResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: { items: MFDSItem[]; totalCount: number; pageNo: number; numOfRows: number };
  };
}

function classifyApplication(itemName: string, deviceName?: string): string {
  const text = `${itemName} ${deviceName ?? ""}`.toLowerCase();
  if (/immunoassay|elisa|serolog|infectious|antibody|antigen|pathogen|virus|bacterial|pcr|nucleic acid/.test(text))
    return "Infectious Disease & Serology";
  if (/tumor|cancer|oncology|biomarker|ctdna|liquid biopsy/.test(text))
    return "Oncology & Tumor Markers";
  if (/cardiac|heart|troponin|bnp|nt-probnp|ck-mb/.test(text))
    return "Cardiac Markers";
  if (/coagulation|hemostasis|thrombosis|clotting|d-dimer/.test(text))
    return "Hemostasis & Thrombosis";
  if (/autoimmune|rheumat|lupus|celiac|autoantibody/.test(text))
    return "Autoimmune Diagnostics";
  if (/point.of.care|rapid|lateral.flow|poc|handheld|portable/.test(text))
    return "Point of Care";
  return "Infectious Disease & Serology";
}

export class MFDSAdapter implements SourceAdapter {
  readonly id = "mfds";
  readonly name = "Korea MFDS";
  readonly description = "South Korea MFDS medical device approvals — diagnostic device companies";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.MFDS_API_KEY ?? "";
  }

  async fetch(): Promise<RawLead[]> {
    if (!this.apiKey) return [];

    const allLeads: RawLead[] = [];
    const seenItems = new Set<string>();

    for (const cat of DEVICE_CATEGORIES) {
      for (let page = 1; page <= 5; page++) {
        try {
          const url = `${MFDS_BASE}/MdcinPrductPrmisnInfoInqire01/getMdcinPrductPrmisnInfoInqire01` +
            `?serviceKey=${encodeURIComponent(this.apiKey)}` +
            `&pageNo=${page}&numOfRows=100` +
            `&type=json`;

          const res = await fetch(url, {
            headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) break;

          const data = await res.json() as MFDSResponse;
          const items = data.response?.body?.items;
          if (!items?.length) break;

          for (const item of items) {
            if (seenItems.has(item.itemSeq)) continue;
            seenItems.add(item.itemSeq);
            if (!item.companyName) continue;

            allLeads.push({
              sourceId: `mfds-${item.itemSeq}`,
              sourceUrl: `https://www.mfds.go.kr/eng/device/${item.itemSeq}`,
              raw: {
                companyName: item.companyName,
                manufacturerName: item.manufacturerName ?? "",
                deviceName: item.deviceName ?? item.itemName,
                itemName: item.itemName,
                approvalDate: item.approvalDate ?? "",
                classification: item.classification ?? "",
                applicationArea: classifyApplication(item.itemName, item.deviceName),
              } as unknown as Record<string, unknown>,
            });
          }
        } catch {
          break;
        }
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const deviceName = r.deviceName as string;
    const itemName = r.itemName as string;
    const approvalDate = r.approvalDate as string;
    const appArea = r.applicationArea as string;

    const signals: Signal[] = [
      {
        type: "MFDS_CLEARANCE",
        date: approvalDate || new Date().toISOString().slice(0, 10),
        confidence: 0.8,
        description: `Korea MFDS approved: ${deviceName} (${itemName})`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      description: `South Korea medical device approval for ${appArea}`,
      applicationAreas: [appArea],
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const url = `${MFDS_BASE}/MdcinPrductPrmisnInfoInqire01/getMdcinPrductPrmisnInfoInqire01` +
        `?serviceKey=${encodeURIComponent(this.apiKey)}` +
        `&pageNo=1&numOfRows=1&type=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run tests/unit/graph/mfds.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/mfds.ts tests/unit/graph/mfds.test.ts
git commit -m "feat: add South Korea MFDS adapter for medical device approvals"
```

---

### Task 4: Australia TGA ARTG Adapter

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/tga.ts`
- Test: `tests/unit/graph/tga.test.ts`

**API Details:** TGA ARTG (Australian Register of Therapeutic Goods) — bulk CSV download from `https://www.tga.gov.au/resources/artg`. Public data, no auth.

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/graph/tga.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TGAAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/tga.js";

describe("TGAAdapter", () => {
  let adapter: TGAAdapter;

  beforeEach(() => {
    adapter = new TGAAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("tga");
    expect(adapter.name).toContain("Australia");
  });

  it("should return empty on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should normalize a CSV row correctly", () => {
    const raw = {
      sourceId: "tga-123456",
      sourceUrl: "https://www.tga.gov.au/artg/123456",
      raw: {
        companyName: "ResMed Australia Pty Ltd",
        productName: "Sleep Apnea Diagnostic Device",
        artgNumber: "123456",
        category: "Class IIa",
        approvalDate: "2023-11-01",
        applicationArea: "Cardiac Markers",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.signals[0].type).toBe("TGA_CLEARANCE");
    expect(result.companyName).toBe("ResMed Australia Pty Ltd");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/unit/graph/tga.test.ts --reporter=verbose
```

- [ ] **Step 3: Write the TGA adapter**

```typescript
// packages/server/src/services/graph/ingest/adapters/tga.ts
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

// The TGA provides a public CSV export of the ARTG
const ARTG_CSV_URL = "https://www.tga.gov.au/sites/default/files/artg-public.csv";
const ARTG_API = "https://www.tga.gov.au/api/v2/artg";

const DEVICE_KEYWORDS = [
  "diagnostic", "assay", "reagent", "test kit", "immunoassay",
  "analyzer", "lateral flow", "rapid test", "elisa",
];

interface TGAEntry {
  artgNumber: string;
  productName: string;
  companyName: string;
  category: string;
  gmdnCode?: string;
  gmdnTerm?: string;
  approvalDate?: string;
  status: string;
}

function classifyTGAProduct(productName: string, gmdnTerm?: string): string {
  const text = `${productName} ${gmdnTerm ?? ""}`.toLowerCase();
  if (/immunoassay|elisa|serolog|infectious|antibody|antigen|pathogen/.test(text))
    return "Infectious Disease & Serology";
  if (/tumor|cancer|oncology|biomarker/.test(text))
    return "Oncology & Tumor Markers";
  if (/cardiac|heart|troponin|bnp/.test(text))
    return "Cardiac Markers";
  if (/coagulation|hemostasis|thrombosis|clotting/.test(text))
    return "Hemostasis & Thrombosis";
  if (/autoimmune|rheumat|lupus|celiac/.test(text))
    return "Autoimmune Diagnostics";
  if (/point.of.care|rapid|lateral.flow|poc/.test(text))
    return "Point of Care";
  return "Infectious Disease & Serology";
}

export class TGAAdapter implements SourceAdapter {
  readonly id = "tga";
  readonly name = "Australia TGA ARTG";
  readonly description = "Australian Register of Therapeutic Goods — medical device entries";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenArtgs = new Set<string>();

    for (const keyword of DEVICE_KEYWORDS) {
      try {
        const url = `${ARTG_API}/search?query=${encodeURIComponent(keyword)}&limit=100`;
        const res = await fetch(url, {
          headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue;

        const data = await res.json() as { results: TGAEntry[] };
        if (!data.results?.length) continue;

        for (const entry of data.results) {
          if (seenArtgs.has(entry.artgNumber)) continue;
          seenArtgs.add(entry.artgNumber);
          if (!entry.companyName || entry.status !== "ACTIVE") continue;

          allLeads.push({
            sourceId: `tga-${entry.artgNumber}`,
            sourceUrl: `https://www.tga.gov.au/artg/${entry.artgNumber}`,
            raw: {
              companyName: entry.companyName,
              productName: entry.productName,
              artgNumber: entry.artgNumber,
              category: entry.category ?? "",
              gmdnTerm: entry.gmdnTerm ?? "",
              approvalDate: entry.approvalDate ?? "",
              applicationArea: classifyTGAProduct(entry.productName, entry.gmdnTerm),
            } as unknown as Record<string, unknown>,
          });
        }
      } catch {
        continue;
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const productName = r.productName as string;
    const approvalDate = r.approvalDate as string;
    const appArea = r.applicationArea as string;
    const artgNumber = r.artgNumber as string;

    const signals: Signal[] = [
      {
        type: "TGA_CLEARANCE",
        date: approvalDate || new Date().toISOString().slice(0, 10),
        confidence: 0.85,
        description: `TGA ARTG ${artgNumber}: ${productName}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      description: `Australian therapeutic goods registration for ${appArea}`,
      applicationAreas: [appArea],
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${ARTG_API}/search?query=diagnostic&limit=1`, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run tests/unit/graph/tga.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/tga.ts tests/unit/graph/tga.test.ts
git commit -m "feat: add Australia TGA ARTG adapter for therapeutic goods register"
```

---

### Task 5: China NMPA Adapter

**Files:**
- Create: `packages/server/src/services/graph/ingest/adapters/nmpa.ts`
- Test: `tests/unit/graph/nmpa.test.ts`

**API Details:** China NMPA (National Medical Products Administration) — UDI database API at `https://udi.nmpa.gov.cn`. Free API key registration.

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/graph/nmpa.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NMPAAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/nmpa.js";

describe("NMPAAdapter", () => {
  let adapter: NMPAAdapter;

  beforeEach(() => {
    adapter = new NMPAAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("nmpa");
    expect(adapter.name).toContain("China");
  });

  it("should skip fetch when NMPA_API_KEY is missing", async () => {
    process.env.NMPA_API_KEY = "";
    const a = new NMPAAdapter();
    const result = await a.fetch();
    expect(result).toEqual([]);
  });

  it("should return empty on fetch error", async () => {
    process.env.NMPA_API_KEY = "test-key";
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const a = new NMPAAdapter();
    const result = await a.fetch();
    expect(result).toEqual([]);
  });

  it("should normalize a raw lead", () => {
    const raw = {
      sourceId: "nmpa-CF-2024-12345",
      sourceUrl: "https://udi.nmpa.gov.cn/device/12345",
      raw: {
        companyName: "Siemens Healthineers Diagnostics (Shanghai) Co., Ltd.",
        deviceName: "Clinical Chemistry Analyzer",
        registrationNumber: "CF-2024-12345",
        approvalDate: "2024-06-15",
        applicationArea: "Specialty Proteins & Reagents",
      },
    };
    const result = raw.raw;
    const adapter = new NMPAAdapter();
    const normalized = adapter.normalize(raw);
    expect(normalized.signals[0].type).toBe("NMPA_CLEARANCE");
    expect(normalized.companyName).toBe(result.companyName as string);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/unit/graph/nmpa.test.ts --reporter=verbose
```

- [ ] **Step 3: Write the NMPA adapter**

```typescript
// packages/server/src/services/graph/ingest/adapters/nmpa.ts
import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const NMPA_API = "https://udi.nmpa.gov.cn/api";
const UDI_DOWNLOAD = "https://udi.nmpa.gov.cn/udi/download";

const SEARCH_TERMS = [
  "诊断试剂",       // diagnostic reagent
  "免疫分析",       // immunoassay
  "生化分析",       // biochemical analysis
  "体外诊断",       // in-vitro diagnostics
  "血糖",           // blood glucose
  "凝血",           // coagulation
  "肿瘤标志物",     // tumor marker
  "心脏标志物",     // cardiac marker
];

const APPLICATION_MAP: Record<string, string> = {
  "诊断试剂": "Infectious Disease & Serology",
  "免疫分析": "Immunoassay",
  "生化分析": "Specialty Proteins & Reagents",
  "体外诊断": "Infectious Disease & Serology",
  "血糖": "Point of Care",
  "凝血": "Hemostasis & Thrombosis",
  "肿瘤标志物": "Oncology & Tumor Markers",
  "心脏标志物": "Cardiac Markers",
};

interface NMPARecord {
  id: string;
  companyName?: string;
  companyNameCn?: string;
  deviceName?: string;
  deviceNameCn?: string;
  registrationNumber?: string;
  approvalDate?: string;
  expiryDate?: string;
  category?: string;
}

interface NMPAResponse {
  code: number;
  message?: string;
  data?: {
    records: NMPARecord[];
    total: number;
    pageNum: number;
    pageSize: number;
  };
}

function classifyApplication(deviceName: string): string {
  const lower = deviceName.toLowerCase();
  if (/immunoassay|elisa|serolog|antibody|antigen|virus|pcr|核酸/.test(lower))
    return "Infectious Disease & Serology";
  if (/tumor|cancer|oncology|biomarker|肿瘤/.test(lower))
    return "Oncology & Tumor Markers";
  if (/cardiac|heart|troponin|心脏/.test(lower))
    return "Cardiac Markers";
  if (/coagulation|hemostasis|clotting|凝血/.test(lower))
    return "Hemostasis & Thrombosis";
  if (/glucose|血糖|point.of.care/.test(lower))
    return "Point of Care";
  if (/autoimmune|rheumat|autoantibody/.test(lower))
    return "Autoimmune Diagnostics";
  return "Infectious Disease & Serology";
}

export class NMPAAdapter implements SourceAdapter {
  readonly id = "nmpa";
  readonly name = "China NMPA";
  readonly description = "China National Medical Products Administration UDI database — medical device registrations";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.NMPA_API_KEY ?? "";
  }

  async fetch(): Promise<RawLead[]> {
    if (!this.apiKey) return [];

    const allLeads: RawLead[] = [];
    const seenIds = new Set<string>();

    for (const term of SEARCH_TERMS) {
      for (let page = 1; page <= 5; page++) {
        try {
          const url = `${NMPA_API}/device/list?` +
            `keyword=${encodeURIComponent(term)}` +
            `&pageNum=${page}&pageSize=100` +
            `&apiKey=${encodeURIComponent(this.apiKey)}`;

          const res = await fetch(url, {
            headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) break;

          const data = await res.json() as NMPAResponse;
          if (data.code !== 200 || !data.data?.records?.length) break;

          for (const record of data.data.records) {
            if (seenIds.has(record.id)) continue;
            seenIds.add(record.id);
            const name = record.companyName ?? record.companyNameCn ?? "";
            if (!name) continue;

            allLeads.push({
              sourceId: `nmpa-${record.id}`,
              sourceUrl: `https://udi.nmpa.gov.cn/device/${record.id}`,
              raw: {
                companyName: name,
                deviceName: record.deviceName ?? record.deviceNameCn ?? "",
                registrationNumber: record.registrationNumber ?? record.id,
                approvalDate: record.approvalDate ?? "",
                applicationArea: record.deviceName
                  ? classifyApplication(record.deviceName)
                  : classifyApplication(record.deviceNameCn ?? ""),
              } as unknown as Record<string, unknown>,
            });
          }
        } catch {
          break;
        }
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const deviceName = r.deviceName as string;
    const regNumber = r.registrationNumber as string;
    const approvalDate = r.approvalDate as string;
    const appArea = r.applicationArea as string;

    const signals: Signal[] = [
      {
        type: "NMPA_CLEARANCE",
        date: approvalDate || new Date().toISOString().slice(0, 10),
        confidence: 0.8,
        description: `China NMPA ${regNumber}: ${deviceName}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      description: `China NMPA medical device registration for ${appArea}`,
      applicationAreas: [appArea],
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const url = `${NMPA_API}/device/list?pageNum=1&pageSize=1&apiKey=${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run test**

```bash
npx vitest run tests/unit/graph/nmpa.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/graph/ingest/adapters/nmpa.ts tests/unit/graph/nmpa.test.ts
git commit -m "feat: add China NMPA adapter for medical device registrations"
```

---

### Task 6: Register all new adapters in SourceManager

**Files:**
- Modify: `packages/server/src/services/graph/ingest/index.ts`

- [ ] **Step 1: Import and register the 4 new adapters**

Edit `packages/server/src/services/graph/ingest/index.ts`:

```typescript
import { MDALLAdapter } from "./adapters/mdall.js";
import { MFDSAdapter } from "./adapters/mfds.js";
import { TGAAdapter } from "./adapters/tga.js";
import { NMPAAdapter } from "./adapters/nmpa.js";
```

Add to `getOrchestrator()` before the `return`:

```typescript
managerInstance.register(new MDALLAdapter(), { weight: 24 });
managerInstance.register(new MFDSAdapter(process.env.MFDS_API_KEY), { weight: 22 });
managerInstance.register(new TGAAdapter(), { weight: 21 });
managerInstance.register(new NMPAAdapter(process.env.NMPA_API_KEY), { weight: 20 });
```

- [ ] **Step 2: Build to verify**

```bash
npm -w packages/server run build
```

Expected: build passes with no errors.

- [ ] **Step 3: Run full test suite**

```bash
npm -w packages/server run test
```

Expected: all 138+ existing tests + 4 new test files pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/services/graph/ingest/index.ts
git commit -m "feat: register MDALL, MFDS, TGA, NMPA adapters in SourceManager"
```

---

### Task 7: Document env vars and update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new env var documentation**

Edit `.env.example`, add after the existing AI section:

```bash
# Tier 1 Adapter API Keys
# MFDS (South Korea): https://www.data.go.kr/ — free API key, 1M requests/day
# MFDS_API_KEY=your-korean-openapi-key

# NMPA (China): https://udi.nmpa.gov.cn — free API key
# NMPA_API_KEY=your-chinese-nmpa-key
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document MFDS and NMPA API keys in env example"
```

---

### Task 8: Update roadmap document with completion status

**Files:**
- Modify: `docs/superpowers/adapter-roadmap.md`

- [ ] **Step 1: Mark Tier 1 adapters as implemented**

Edit the Tier 1 table, change status/notes column to indicate they're done.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/adapter-roadmap.md
git commit -m "docs: update adapter roadmap with Tier 1 completion"
```

---

### Task 9: Build and deploy

**Files:**
- Modify: `.env.production` (on server)

- [ ] **Step 1: Docker build**

```bash
docker compose -f docker-compose.prod.yml build leads-app
```

Expected: build succeeds.

- [ ] **Step 2: Push .env.production with new keys**

On server, add to `/opt/leadgraph/.env.production`:
```
MFDS_API_KEY=...
NMPA_API_KEY=...
```

- [ ] **Step 3: Deploy**

```bash
docker compose -f docker-compose.prod.yml up -d leads-app
```

- [ ] **Step 4: Verify new adapters are registered**

```bash
curl https://leads.graphwiz.ai/api/graph/health
# Should see mdall, mfds, tga, nmpa in the adapters list
```

- [ ] **Step 5: Run full ingestion**

```bash
curl -X POST https://leads.graphwiz.ai/api/graph/ingest
# Check for mdall/mfds/tga/nmpa summaries with company counts
```

- [ ] **Step 6: Run scoring**

```bash
curl -X POST https://leads.graphwiz.ai/api/graph/score/run
```

- [ ] **Step 7: Verify stats increased**

```bash
curl https://leads.graphwiz.ai/api/graph/stats
# Expected: company count significantly higher (~14,000+)
```

- [ ] **Step 8: Commit deployment config**

```bash
git add .env.example
git commit -m "chore: add MFDS/NMPA API keys to deployment config"
```
