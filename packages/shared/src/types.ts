// ─── API Response ──────────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Pipeline CRM Types ────────────────────────────────────────────────────
export type PipelineStage =
  | "New"
  | "Contacted"
  | "Meeting"
  | "Proposal"
  | "Closed Won"
  | "Closed Lost";

export const PIPELINE_STAGES: PipelineStage[] = [
  "New",
  "Contacted",
  "Meeting",
  "Proposal",
  "Closed Won",
  "Closed Lost",
];

export interface ActivityNote {
  id: string;
  type: "NOTE" | "EMAIL" | "CALL" | "MEETING" | "STAGE_CHANGE";
  note: string;
  date: string;
  createdBy?: string;
}

export interface PipelineLead {
  id: string;
  contactName: string;
  email?: string;
  role?: string;
  companyName: string;
  companyDomain?: string;
  companyTier?: "HOT" | "WARM" | "COLD";
  companyScore?: number;
  stage: PipelineStage;
  stageEnteredAt: string;
  notes: ActivityNote[];
}

export interface StartPipelineInput {
  companyName: string;
  contactName: string;
  email?: string;
  role?: string;
}

export interface AddNoteInput {
  contactId: string;
  note: string;
  type?: ActivityNote["type"];
}

export interface PipelineSummary {
  totalLeads: number;
  byStage: Record<PipelineStage, number>;
}
