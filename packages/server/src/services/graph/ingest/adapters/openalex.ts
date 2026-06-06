import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const OA_API = "https://api.openalex.org/works";

const SEARCH_QUERIES = [
  "diagnostic antibody assay immunoassay",
  "rapid diagnostic test antigen detection",
  "serology assay point of care",
  "lateral flow immunoassay development",
  "elisa biomarker detection clinical",
];

interface OAInstitution {
  id: string;
  display_name: string;
  ror?: string;
  country_code?: string;
  type: string;
}

interface OAAuthorship {
  author: { display_name: string };
  institutions: OAInstitution[];
  countries: string[];
}

interface OAWork {
  id: string;
  doi?: string;
  title: string;
  display_name: string;
  publication_date: string;
  primary_location?: {
    source?: { display_name?: string };
    landing_page_url?: string;
  };
  authorships: OAAuthorship[];
  concepts?: Array<{ display_name: string; score: number }>;
  cited_by_count?: number;
}

interface OAResponse {
  meta: { count: number; per_page: number; page: number };
  results: OAWork[];
}

async function fetchBatch(query: string): Promise<OAWork[]> {
  const allWorks: OAWork[] = [];
  const filter = "authorships.institutions.type:company";
  const encodedQuery = encodeURIComponent(query);
  let url = `${OA_API}?search=${encodedQuery}&filter=${filter}&per_page=100&sort=publication_date:desc`;

  for (let page = 0; page < 10; page++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "LeadGraph/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) break;
      const data = (await res.json()) as OAResponse;
      if (!data.results?.length) break;
      allWorks.push(...data.results);
      const nextPage = page + 2;
      url = `${OA_API}?search=${encodedQuery}&filter=${filter}&per_page=100&sort=publication_date:desc&page=${nextPage}`;
    } catch {
      break;
    }
  }

  return allWorks;
}

function workConceptsToAppAreas(concepts: Array<{ display_name: string; score: number }> | undefined): string[] {
  if (!concepts) return ["Infectious Disease & Serology"];
  const names = concepts.filter((c) => c.score > 0.5).map((c) => c.display_name.toLowerCase());
  const combined = names.join(" ");
  const areas: string[] = [];

  if (/infectious|serolog|immunoassay|elisa|antibody|antigen|pathogen|virus|bacterial|microbiology/.test(combined))
    areas.push("Infectious Disease & Serology");
  if (/autoimmune|rheumat|lupus|celiac|autoantibody/.test(combined))
    areas.push("Autoimmune Diagnostics");
  if (/tumor|cancer|oncology|neoplasm|biomarker|circulating/.test(combined))
    areas.push("Oncology & Tumor Markers");
  if (/cardiac|heart|cardiovascular|troponin/.test(combined))
    areas.push("Cardiac Markers");
  if (/coagulation|hemostasis|thrombosis|clotting/.test(combined))
    areas.push("Hemostasis & Thrombosis");
  if (/point.of.care|lateral.flow|rapid.test|poc/.test(combined))
    areas.push("Point of Care");

  if (areas.length === 0) areas.push("Infectious Disease & Serology");
  return areas;
}

export class OpenAlexAdapter implements SourceAdapter {
  readonly id = "openalex";
  readonly name = "OpenAlex Research";
  readonly description = "Research publications from OpenAlex — papers with company-affiliated authors in diagnostic space";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenWorkIds = new Set<string>();

    for (const query of SEARCH_QUERIES) {
      const works = await fetchBatch(query);
      for (const work of works) {
        if (seenWorkIds.has(work.id)) continue;
        seenWorkIds.add(work.id);

        const companyAuthors = work.authorships.filter(
          (a) => a.institutions?.some((inst) => inst.type === "company")
        );
        if (!companyAuthors.length) continue;

        const companyNames = [
          ...new Set(
            companyAuthors.flatMap((a) =>
              a.institutions
                .filter((inst) => inst.type === "company")
                .map((inst) => inst.display_name)
            )
          ),
        ];

        for (const companyName of companyNames) {
          allLeads.push({
            sourceId: `oa-${work.id.split("/").pop()}`,
            sourceUrl: work.doi
              ? `https://doi.org/${work.doi}`
              : work.primary_location?.landing_page_url,
            raw: {
              workId: work.id,
              companyName,
              title: work.title ?? work.display_name,
              publicationDate: work.publication_date,
              concepts: work.concepts ?? [],
              doi: work.doi,
              citedByCount: work.cited_by_count ?? 0,
              journalName: work.primary_location?.source?.display_name ?? "",
            } as unknown as Record<string, unknown>,
          });
        }
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const title = r.title as string;
    const pubDate = r.publicationDate as string;
    const concepts = r.concepts as Array<{ display_name: string; score: number }>;
    const journalName = r.journalName as string;

    const appAreas = workConceptsToAppAreas(concepts);
    const signals: Signal[] = [
      {
        type: "RESEARCH_PUBLICATION",
        date: pubDate || new Date().toISOString().slice(0, 10),
        confidence: 0.6,
        description: `${title.slice(0, 200)}${journalName ? ` (${journalName})` : ""}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      description: `Research publication: ${title.slice(0, 120)}`,
      applicationAreas: appAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${OA_API}?per_page=1`, {
        headers: { "User-Agent": "LeadGraph/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
