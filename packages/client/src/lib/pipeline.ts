import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "./api";

export type PipelineStage = "New" | "Contacted" | "Meeting" | "Proposal" | "Closed Won" | "Closed Lost";

export interface ActivityNote {
  id: string;
  type: "NOTE" | "EMAIL" | "CALL" | "MEETING" | "STAGE_CHANGE" | "PREFERENCE_CONFIRMED" | "OUTREACH_SENT";
  note: string;
  date: string;
}

export interface PipelineLead {
  id: string;
  stage: PipelineStage;
  currentStage: PipelineStage;
  companyName: string;
  companyDomain?: string;
  companySegment?: string;
  companyDescription?: string;
  companyTier?: "HOT" | "WARM" | "COLD";
  contactName: string;
  email?: string;
  role?: string;
  stageEnteredAt: string;
  notes: ActivityNote[];
  contacts: ContactSummary[];
  lastActivity?: string;
}

export interface ContactSummary {
  id: string;
  name: string;
  email?: string;
  role?: string;
  stage: string;
  enteredAt: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  note: string;
  date: string;
}

export const STAGES = ["New", "Contacted", "Meeting", "Proposal", "Closed Won", "Closed Lost"] as const;
export type StageName = (typeof STAGES)[number];

export function usePipelineLeads() {
  return useQuery({
    queryKey: ["pipeline", "leads"],
    queryFn: async () => {
      const res = await apiGet<{ leads: PipelineLead[] }>("/api/pipeline/leads");
      if (!res.ok) throw new Error(res.error.message);
      return res.data.leads;
    },
    refetchInterval: 15_000,
  });
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline", "stages"],
    queryFn: async () => {
      const res = await apiGet<{ stages: string[] }>("/api/pipeline/stages");
      if (!res.ok) throw new Error(res.error.message);
      return res.data.stages;
    },
    staleTime: Infinity,
  });
}

export function useStartPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      companyName: string;
      contactName?: string;
      email?: string;
      role?: string;
    }) => {
      const res = await apiPost<{ contactId: string }>("/api/pipeline/start", params);
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useAdvanceStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: string | { contactId: string; targetStage: string }) => {
      const contactId = typeof params === "string" ? params : params.contactId;
      const stage = typeof params === "string" ? undefined : params.targetStage;
      const res = await apiPut<{ newStage: string }>(`/api/pipeline/${contactId}/advance`, stage ? { stage } : {});
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useRegressStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { contactId: string; stage: string }) => {
      const res = await apiPut<{ newStage: string }>(`/api/pipeline/${params.contactId}/regress`, {
        stage: params.stage,
      });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useAddActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { contactId: string; type: string; note: string }) => {
      const res = await apiPost<{ activityId: string }>(
        `/api/pipeline/${params.contactId}/activity`,
        { type: params.type, note: params.note }
      );
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { contactId: string; note: string; type: ActivityNote["type"] }) => {
      const res = await apiPost<{ activityId: string }>(
        `/api/pipeline/${params.contactId}/activity`,
        { type: params.type, note: params.note }
      );
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useContactActivity(contactId: string | null) {
  return useQuery({
    queryKey: ["pipeline", "activity", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const res = await apiGet<{ activities: ActivityNote[] }>(
        `/api/pipeline/${contactId}/activity`
      );
      if (!res.ok) throw new Error(res.error.message);
      return res.data.activities;
    },
    enabled: !!contactId,
  });
}

// ── Outreach hooks ─────────────────────────────────────────────

export function useRunOutreach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiPost<{ totalQualified: number; results: any[] }>(
        "/api/agents/outreach/run",
        {},
      );
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useGeneratePreferenceLink() {
  return useMutation({
    mutationFn: async (params: {
      contactId: string;
      companyName: string;
      contactName: string;
      email: string;
      role: string;
    }) => {
      const res = await apiPost<{ token: string; url: string; expiresAt: string }>(
        "/api/agents/preferences/generate-token",
        params,
      );
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}
