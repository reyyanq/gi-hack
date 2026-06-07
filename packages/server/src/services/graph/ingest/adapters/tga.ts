import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const TGA_API = "https://data.tga.gov.au/ARTGSearch/ARTGWebService.svc/JSON/ARTGValueSearch";

// Device entries start appearing around offset 10,000 and continue to ~60,000.
// Beyond 60k responses can be too large to parse, so we skip those.
const START_OFFSET = 10_000;
const MAX_PAGES = 5;
const PAGE_SIZE = 1000;

const DIAGNOSTIC_GMDN_TERMS = [
  /in.?vitro.?diagnostic/i,
  /diagnostic.?test.?kit/i,
  /reagent/i,
  /assay/i,
  /immunoassay/i,
  /analyzer/i,
  /laboratory.?diagnostic/i,
  /pathology/i,
  /serolog/i,
  /infectious.?disease.?test/i,
  /rapid.?test/i,
  /lateral.?flow/i,
  /elisa/i,
  /clinical.?chemistry/i,
  /blood.?gas.?analyzer/i,
  /glucose.?monitoring/i,
  /coagulation.?reagent/i,
  /hematology.?analyzer/i,
  /microbiology.?test/i,
  /molecular.?diagnostic/i,
  /pcr.?test/i,
  /point.?of.?care.?test/i,
];

function isDiagnosticRelated(gmdnTerm: string): boolean {
  return DIAGNOSTIC_GMDN_TERMS.some((re) => re.test(gmdnTerm));
}

function classifyApplication(productGmdnTerms: string[]): string {
  const text = productGmdnTerms.join(" ").toLowerCase();
  if (/infectious|pathogen|virus|bacterial|serolog|antibody|antigen/.test(text))
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
  if (/reagent|assay|immunoassay|elisa|chemistry/.test(text))
    return "Specialty Proteins & Reagents";
  if (/hematology|microbiology|molecular|pcr/.test(text))
    return "Infectious Disease & Serology";
  if (/glucose|blood.gas/.test(text))
    return "Cardiac Markers";
  return "Infectious Disease & Serology";
}

export class TGAAdapter implements SourceAdapter {
  readonly id = "tga";
  readonly name = "Australia TGA ARTG";
  readonly description = "Australian Register of Therapeutic Goods — medical device entries";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenArtgs = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const pageStart = START_OFFSET + page * PAGE_SIZE + 1;
        const pageEnd = START_OFFSET + (page + 1) * PAGE_SIZE;
        const url = `${TGA_API}/?pagestart=${pageStart}&pageend=${pageEnd}`;

        const res = await fetch(url, {
          headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) break;

        let data: { Results?: any[] };
        try {
          data = (await res.json()) as { Results?: any[] };
        } catch {
          break; // skip pages where response is too large to parse
        }
        const entries = Array.isArray(data?.Results) ? data.Results : [];
        if (entries.length === 0) break;

        for (const entry of entries) {
          if (entry.EntryType !== "Medical Device Included") continue;
          if (!entry.ARTGNumber || seenArtgs.has(entry.ARTGNumber)) continue;

          const companyName = entry.Sponsor?.Name?.trim();
          if (!companyName) continue;

          const products = Array.isArray(entry.Products) ? entry.Products : [];
          const gmdnTerms: string[] = products
            .map((p: any) => p.GMDNTerm ?? "")
            .filter(Boolean);

          if (!gmdnTerms.some(isDiagnosticRelated)) continue;

          seenArtgs.add(entry.ARTGNumber);
          const approvalDate: string = entry.ApprovalDate ?? "";
          const appArea = classifyApplication(gmdnTerms);

          allLeads.push({
            sourceId: `tga-${entry.ARTGNumber}`,
            sourceUrl: `https://www.tga.gov.au/resources/artg/${entry.ARTGNumber}`,
            raw: {
              companyName,
              gmdnTerms,
              artgNumber: entry.ARTGNumber,
              approvalDate,
              applicationArea: appArea,
            } as unknown as Record<string, unknown>,
          });
        }
      } catch {
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const gmdnTerms = (r.gmdnTerms as string[]) ?? [];
    const approvalDate = r.approvalDate as string;
    const appArea = r.applicationArea as string;
    const artgNumber = r.artgNumber as string;

    const gmdnDesc = gmdnTerms.length > 0 ? gmdnTerms.join(", ") : "";
    const desc = gmdnDesc
      ? `TGA ARTG ${artgNumber}: ${gmdnDesc}`
      : `TGA ARTG ${artgNumber}`;

    const signals: Signal[] = [
      {
        type: "TGA_CLEARANCE",
        date: approvalDate || new Date().toISOString().slice(0, 10),
        confidence: 0.85,
        description: desc,
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
      const res = await fetch(`${TGA_API}/?pagestart=1&pageend=5`, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { Results?: any[] };
      return Array.isArray(data?.Results) && data.Results.length > 0;
    } catch {
      return false;
    }
  }
}
