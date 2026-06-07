import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const MFDS_BASE = "https://apis.data.go.kr/1471000";

interface MFDSItem {
  itemName: string;
  itemSeq: string;
  deviceName?: string;
  companyName?: string;
  manufacturerName?: string;
  approvalDate?: string;
  classification?: string;
}

interface MFDSBody {
  items: MFDSItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
}

interface MFDSResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: MFDSBody;
  };
}

function classifyApplication(itemName: string, deviceName?: string): string {
  const text = `${itemName} ${deviceName ?? ""}`.toLowerCase();
  if (/immunoassay|elisa|serolog|infectious|antibody|antigen|pathogen|virus|bacterial|pcr/.test(text))
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

    for (let page = 1; page <= 5; page++) {
        try {
          const url =
            `${MFDS_BASE}/MdcinPrductPrmisnInfoInqire01/getMdcinPrductPrmisnInfoInqire01` +
            `?serviceKey=${encodeURIComponent(this.apiKey)}` +
            `&pageNo=${page}&numOfRows=100` +
            `&type=json`;

          const res = await fetch(url, {
            headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) break;

          const data = (await res.json()) as MFDSResponse;
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
      const url =
        `${MFDS_BASE}/MdcinPrductPrmisnInfoInqire01/getMdcinPrductPrmisnInfoInqire01` +
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
