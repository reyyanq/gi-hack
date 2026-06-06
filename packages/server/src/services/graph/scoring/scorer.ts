import { queryRows, runQuery } from "../neo4j.js";
import { ScoredResult, ContactInfo } from "./types.js";

const SEGMENT_BONUS: Record<string, number> = {
  IVD_MANUFACTURER: 20,
  CDMO: 15,
  SUPPLIER: 10,
  RESEARCH: 5,
};

const SIGNAL_WEIGHTS: Record<string, number> = {
  FDA_CLEARANCE: 40,
  CLINICAL_TRIAL: 30,
  PATENT: 25,
  HIRING: 20,
  FUNDING: 15,
  NEWS: 10,
};

interface SignalRow {
  type: string;
  date: string;
  confidence: number;
  description: string;
}

interface CompanyRow {
  name: string;
  domain: string | null;
  segment: string | null;
  region: string | null;
  signals: SignalRow[];
  applications: string[];
}

function recencyBonus(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months <= 3) return 10;
  if (months <= 6) return 7;
  if (months <= 12) return 4;
  return 1;
}

function generateHook(signals: SignalRow[]): string | undefined {
  const sorted = [...signals].filter((s) => s.type && s.date).sort((a, b) => b.confidence - a.confidence);
  if (sorted.length === 0) return undefined;
  const top = sorted[0];
  switch (top.type) {
    case "FDA_CLEARANCE":
      return `Congrats on the recent clearance — how are you sourcing raw materials for scale-up?`;
    case "CLINICAL_TRIAL":
      return `Noticed your trial activity — are you evaluating biological intermediate suppliers for the next phase?`;
    case "HIRING":
      return `Saw you're expanding your team — as you scale assay development, we could help with raw materials.`;
    case "FUNDING":
      return `Congrats on the funding! As you scale diagnostic production, we'd love to discuss our intermediate portfolio.`;
    case "PATENT":
      return `Your recent patent looks promising — are you planning to commercialize? We supply key intermediates.`;
    default:
      return undefined;
  }
}

async function fetchContactsForCompanies(companyNames: string[]): Promise<Map<string, ContactInfo[]>> {
  if (companyNames.length === 0) return new Map();

  const result = await runQuery(
    `MATCH (c:Company)<-[:CONTACT_AT]-(contact:Contact)
     WHERE c.name IN $companyNames
     RETURN c.name AS companyName,
            contact.id AS id,
            contact.name AS name,
            contact.email AS email,
            contact.role AS role`,
    { companyNames }
  );

  const contactMap = new Map<string, ContactInfo[]>();
  for (const row of (result.records ?? [])) {
    const r = row as any;
    const companyName = r.companyName as string;
    if (!contactMap.has(companyName)) {
      contactMap.set(companyName, []);
    }
    contactMap.get(companyName)!.push({
      id: r.id as string,
      name: r.name as string,
      email: r.email as string | undefined,
      role: r.role as string | undefined,
    });
  }
  return contactMap;
}

export async function scoreAll(): Promise<ScoredResult[]> {
  const result = await queryRows(
    `MATCH (c:Company)
     WHERE c.name <> "Siemens Healthineers"
     AND NOT EXISTS {
       MATCH (c)-[:SUPPLIES_TO]->(:Company {name: "Siemens Healthineers"})
     }
     OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
     OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
     RETURN c.name AS name,
            c.domain AS domain,
            c.segment AS segment,
            c.region AS region,
            [sig IN collect(DISTINCT {type: s.type, date: s.date, confidence: s.confidence, description: s.description}) WHERE sig.type IS NOT NULL] AS signals,
            collect(DISTINCT a.name) AS applications
     ORDER BY c.name`
  );

  const rows = result as unknown as CompanyRow[];

  // Get Siemens applications for product fit scoring
  const siemensResult = await queryRows(
    `MATCH (:Company {normalizedName: "siemens healthineers"})-[:SUPPLIES]->(:Product)-[:USED_IN]->(a:Application)
     RETURN collect(DISTINCT a.name) AS apps`
  );
  const siemensApps: string[] = (siemensResult[0] as any)?.apps ?? [];

  // Fetch all contacts for companies
  const companyNames = rows.map(r => r.name);
  const contactsMap = await fetchContactsForCompanies(companyNames);

  const scored: ScoredResult[] = [];

  for (const row of rows) {
    const disqualifiers: string[] = [];
    const validSignals = (row.signals ?? []) as SignalRow[];

    if (validSignals.length === 0) disqualifiers.push("No signals detected — insufficient data");
    if (!row.domain) disqualifiers.push("No domain/website — hard to qualify");
    if (row.segment === "RESEARCH") disqualifiers.push("Research segment — unlikely B2B buyer");

    let signalScore = 0;
    let maxRecency = 0;
    for (const s of validSignals) {
      const weight = SIGNAL_WEIGHTS[s.type] ?? 5;
      const recency = recencyBonus(s.date);
      signalScore += weight * (s.confidence ?? 0.5);
      if (recency > maxRecency) maxRecency = recency;
    }
    signalScore = Math.min(signalScore / 10, 40);

    const overlap = row.applications.filter((a: string) => siemensApps.includes(a));
    const productFitScore = Math.min((overlap.length / Math.max(siemensApps.length, 1)) * 30, 30);

    const segmentBonus = SEGMENT_BONUS[row.segment ?? ""] ?? 0;

    const breakdown = {
      signalScore: Math.round(signalScore),
      productFitScore: Math.round(productFitScore),
      segmentBonus,
      recencyBonus: Math.round(maxRecency),
    };

    const totalScore = Math.min(
      breakdown.signalScore + breakdown.productFitScore + breakdown.segmentBonus + breakdown.recencyBonus,
      100
    );

    let tier: "HOT" | "WARM" | "COLD";
    if (totalScore >= 70) tier = "HOT";
    else if (totalScore >= 40) tier = "WARM";
    else tier = "COLD";

    const outreachHook = disqualifiers.length === 0 && totalScore >= 40 ? generateHook(validSignals) : undefined;

    scored.push({
      companyName: row.name,
      domain: row.domain ?? undefined,
      segment: row.segment ?? undefined,
      region: row.region ?? undefined,
      tier,
      totalScore,
      breakdown,
      disqualifiers,
      outreachHook,
      contacts: contactsMap.get(row.name) ?? [],
      signals: validSignals,
      applications: row.applications,
    });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored;
}
