export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  fetch(): Promise<RawLead[]>;
  normalize(raw: RawLead): LeadCandidate;
  healthCheck(): Promise<boolean>;
}

export interface RawLead {
  sourceId: string;
  sourceUrl?: string;
  raw: Record<string, unknown>;
}

export interface LeadCandidate {
  sourceId: string;
  companyName: string;
  domain?: string;
  description?: string;
  applicationAreas: string[];
  signals: Signal[];
}

export interface Signal {
  type: SignalType;
  date: string;
  confidence: number;
  description: string;
  url?: string;
}

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

export interface IngestionSummary {
  sourceId: string;
  fetched: number;
  created: number;
  failed: number;
  errors: string[];
}

export interface SourceConfig {
  weight: number;
  concurrency?: number;
  enabled: boolean;
}

export type TierLevel = "HOT" | "WARM" | "COLD";

export interface Disqualifier {
  reason: string;
  severity: "HARD" | "SOFT";
}

export interface ScoreBreakdown {
  signalScore: number;
  productFitScore: number;
  segmentBonus: number;
  recencyBonus: number;
  total: number;
}

export interface ScoredCompany {
  companyName: string;
  tier: TierLevel;
  score: number;
  breakdown: ScoreBreakdown;
  disqualifiers: Disqualifier[];
  outreachHook?: string;
}

export interface SeedSummary {
  constraintsCreated: number;
  applicationAreas: number;
  companiesSeeded: number;
  productsSeeded: number;
  relationshipsCreated: number;
}
