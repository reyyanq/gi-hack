import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const NMPA_API = "https://udi.nmpa.gov.cn/api";

const SEARCH_TERMS: Array<{ term: string; application: string }> = [
  { term: "\u8bca\u65ad\u8bd5\u5242", application: "Infectious Disease & Serology" },
  { term: "\u514d\u75ab\u5206\u6790", application: "Infectious Disease & Serology" },
  { term: "\u751f\u5316\u5206\u6790", application: "Specialty Proteins & Reagents" },
  { term: "\u4f53\u5916\u8bca\u65ad", application: "Infectious Disease & Serology" },
  { term: "\u8840\u7cd6", application: "Point of Care" },
  { term: "\u51dd\u8840", application: "Hemostasis & Thrombosis" },
  { term: "\u80bf\u7624\u6807\u5fd7\u7269", application: "Oncology & Tumor Markers" },
  { term: "\u5fc3\u810f\u6807\u5fd7\u7269", application: "Cardiac Markers" },
];

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
  if (/immunoassay|elisa|serolog|antibody|antigen|virus|pcr/.test(lower))
    return "Infectious Disease & Serology";
  if (/tumor|cancer|oncology|biomarker/.test(lower))
    return "Oncology & Tumor Markers";
  if (/cardiac|heart|troponin|bnp/.test(lower))
    return "Cardiac Markers";
  if (/coagulation|hemostasis|clotting/.test(lower))
    return "Hemostasis & Thrombosis";
  if (/glucose|point.of.care/.test(lower))
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

    for (const search of SEARCH_TERMS) {
      for (let page = 1; page <= 5; page++) {
        try {
          const url =
            `${NMPA_API}/device/list` +
            `?keyword=${encodeURIComponent(search.term)}` +
            `&pageNum=${page}&pageSize=100` +
            `&apiKey=${encodeURIComponent(this.apiKey)}`;

          const res = await fetch(url, {
            headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) break;

          const data = (await res.json()) as NMPAResponse;
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
                applicationArea: classifyApplication(
                  record.deviceName ?? record.deviceNameCn ?? ""
                ),
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
      const url =
        `${NMPA_API}/device/list?pageNum=1&pageSize=1` +
        `&apiKey=${encodeURIComponent(this.apiKey)}`;
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
