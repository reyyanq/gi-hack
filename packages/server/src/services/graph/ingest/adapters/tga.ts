import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

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
  gmdnTerm?: string;
  approvalDate?: string;
  status: string;
}

function classifyApplication(productName: string, gmdnTerm?: string): string {
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

        const data = (await res.json()) as { results: TGAEntry[] };
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
              applicationArea: classifyApplication(entry.productName, entry.gmdnTerm),
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
