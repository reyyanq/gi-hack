import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "./api";

export interface PipelineLead {
  companyName: string;
  companyDomain?: string;
  companySegment?: string;
  companyDescription?: string;
  contacts: ContactSummary[];
  currentStage: StageName;
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
      contactEmail?: string;
      contactRole?: string;
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
    mutationFn: async (contactId: string) => {
      const res = await apiPut<{ newStage: string }>(`/api/pipeline/${contactId}/advance`, {});
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

export function useContactActivity(contactId: string | null) {
  return useQuery({
    queryKey: ["pipeline", "activity", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const res = await apiGet<{ activities: ActivityEntry[] }>(
        `/api/pipeline/${contactId}/activity`
      );
      if (!res.ok) throw new Error(res.error.message);
      return res.data.activities;
    },
    enabled: !!contactId,
  });
}
