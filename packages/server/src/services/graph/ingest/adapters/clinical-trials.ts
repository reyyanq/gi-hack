import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const CT_API = "https://clinicaltrials.gov/api/v2/studies";

const QUERY_BATCHES = [
  { term: "diagnostic immunoassay", area: "Infectious Disease & Serology" },
  { term: "rapid antigen test antibody", area: "Infectious Disease & Serology" },
  { term: "serology assay elisa", area: "Specialty Proteins & Reagents" },
  { term: "point of care diagnostic lateral flow", area: "Point of Care" },
  { term: "chemiluminescence immunofluorescence", area: "Specialty Proteins & Reagents" },
];

interface CTStudy {
  protocolSection: {
    identificationModule: {
      nctId: string;
      organization?: { fullName: string };
      briefTitle: string;
    };
    statusModule: {
      overallStatus: string;
      startDateStruct?: { date: string; type?: string };
    };
    sponsorCollaboratorsModule: {
      leadSponsor: { name: string; class: string };
    };
    conditionsModule?: {
      conditions: string[];
    };
    descriptionModule?: {
      briefSummary?: string;
    };
  };
}

interface CTResponse {
  studies: CTStudy[];
  nextPageToken?: string;
}

async function fetchBatch(term: string): Promise<CTStudy[]> {
  const studies: CTStudy[] = [];
  const statuses = "RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION,NOT_YET_RECRUITING";
  let url = `${CT_API}?query.term=${encodeURIComponent(term)}&filter.overallStatus=${statuses}&pageSize=100&format=json`;

  for (let page = 0; page < 5; page++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "LeadGraph/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) break;
      const data = (await res.json()) as CTResponse;
      if (!data.studies?.length) break;
      studies.push(...data.studies);
      if (!data.nextPageToken) break;
      url = `${CT_API}?pageToken=${data.nextPageToken}&pageSize=100&format=json`;
    } catch {
      break;
    }
  }

  return studies;
}

function extractApplicationAreas(conditions: string[] | undefined): string[] {
  if (!conditions?.length) return ["Infectious Disease & Serology"];
  const combined = conditions.join(" ").toLowerCase();
  const areas: string[] = [];

  if (/infectious|serolog|hepatitis|hiv|covid|tb|tuberculosis|malaria|dengue|zika|ebola|influenza|respiratory|sars|meningitis|sepsis|syphilis|chlamydia|gonorrhea|hpv/.test(combined))
    areas.push("Infectious Disease & Serology");
  if (/autoimmune|rheumat|lupus|celiac|ibd|crohn|colitis|sjogren|scleroderma|vasculitis|myasthenia|guillain/.test(combined))
    areas.push("Autoimmune Diagnostics");
  if (/tumor|cancer|oncology|neoplasm|malignancy|carcinoma|sarcoma|leukemia|lymphoma|myeloma|biomarker/.test(combined))
    areas.push("Oncology & Tumor Markers");
  if (/cardiac|heart|cardiovascular|troponin|bnp|nt-probnp|ck-mb|myoglobin|coronary|myocardial|infarction|heart failure|arrhythmia/.test(combined))
    areas.push("Cardiac Markers");
  if (/coagulation|hemostasis|thrombosis|clotting|d-dimer|fibrinogen|pt|inr|aptt|anticoagulant|hemophilia|von willebrand/.test(combined))
    areas.push("Hemostasis & Thrombosis");
  if (/allergy|allergen|ige|anaphylaxis|hypersensitivity|atopic|asthma|rhinitis/.test(combined))
    areas.push("Allergy Diagnostics");
  if (/endocrin|thyroid|tsh|t3|t4|cortisol|insulin|glucose|hba1c|diabetes|hcg|prolactin|fsh|lh|testosterone|estrogen|progesterone/.test(combined))
    areas.push("Endocrinology");
  if (/transplant|hla|immunosuppress|rejection|graft|donor|recipient/.test(combined))
    areas.push("Transplant Diagnostics");

  if (areas.length === 0) areas.push("Infectious Disease & Serology");
  return areas;
}

export class ClinicalTrialsAdapter implements SourceAdapter {
  readonly id = "clinical-trials";
  readonly name = "ClinicalTrials.gov";
  readonly description = "Real clinical trial registrations from clinicaltrials.gov — diagnostic assay studies";

  async fetch(): Promise<RawLead[]> {
    const allLeads: RawLead[] = [];
    const seenNctIds = new Set<string>();

    for (const batch of QUERY_BATCHES) {
      const studies = await fetchBatch(batch.term);
      for (const study of studies) {
        const nctId = study.protocolSection.identificationModule.nctId;
        if (seenNctIds.has(nctId)) continue;
        seenNctIds.add(nctId);

        const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor;
        const companyName = sponsor?.name ?? "Unknown";
        const conditions = study.protocolSection.conditionsModule?.conditions;

        allLeads.push({
          sourceId: `ct-${nctId}`,
          sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
          raw: {
            nctId,
            companyName,
            briefTitle: study.protocolSection.identificationModule.briefTitle,
            conditions: conditions ?? [],
            overallStatus: study.protocolSection.statusModule.overallStatus,
            startDate: study.protocolSection.statusModule.startDateStruct?.date ?? "",
            sponsorClass: sponsor?.class ?? "",
            assignedArea: batch.area,
          } as unknown as Record<string, unknown>,
        });
      }
    }

    return allLeads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const r = raw.raw as Record<string, unknown>;
    const companyName = r.companyName as string;
    const conditions = r.conditions as string[];
    const briefTitle = r.briefTitle as string;
    const startDate = r.startDate as string;
    const nctId = r.nctId as string;

    const applicationAreas = extractApplicationAreas(conditions);
    const signals: Signal[] = [
      {
        type: "CLINICAL_TRIAL",
        date: startDate || new Date().toISOString().slice(0, 10),
        confidence: 0.7,
        description: `${briefTitle.slice(0, 200)} (${nctId})`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName,
      description: `Clinical trial: ${briefTitle.slice(0, 150)}`,
      applicationAreas,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${CT_API}?pageSize=1&format=json`, {
        headers: { "User-Agent": "LeadGraph/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
