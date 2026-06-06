
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PipelineLead,
  ActivityNote,
  StartPipelineInput,
  AddNoteInput,
  PipelineSummary,
  PipelineStage,
} from "@gi-hack/shared";    // ← tek değişen satır bu

// Re-export types for convenience in UI components
export type { PipelineLead, ActivityNote, PipelineStage, PipelineSummary };

// ── Base fetch helper ─────────────────────────────────────────

const API = "/api/pipeline";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error?.message ?? "API error");
  }
  return json.data as T;
}

// ── Query Keys ────────────────────────────────────────────────

export const pipelineKeys = {
  all:      ["pipeline"] as const,
  leads:    () => [...pipelineKeys.all, "leads"] as const,
  summary:  () => [...pipelineKeys.all, "summary"] as const,
  activity: (id: string) => [...pipelineKeys.all, "activity", id] as const,
};

// ── usePipelineLeads ──────────────────────────────────────────

export function usePipelineLeads() {
  return useQuery({
    queryKey: pipelineKeys.leads(),
    queryFn: () => apiFetch<PipelineLead[]>("/leads"),
    refetchInterval: 30_000,
  });
}

// ── usePipelineSummary ────────────────────────────────────────

export function usePipelineSummary() {
  return useQuery({
    queryKey: pipelineKeys.summary(),
    queryFn: () => apiFetch<PipelineSummary>("/summary"),
  });
}

// ── useActivity ───────────────────────────────────────────────

export function useActivity(contactId: string | null) {
  return useQuery({
    queryKey: pipelineKeys.activity(contactId ?? ""),
    queryFn: () => apiFetch<ActivityNote[]>(`/${contactId}/activity`),
    enabled: Boolean(contactId),
  });
}

// ── useStartPipeline ──────────────────────────────────────────

export function useStartPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartPipelineInput) =>
      apiFetch<PipelineLead>("/start", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.leads() });
      queryClient.invalidateQueries({ queryKey: pipelineKeys.summary() });
    },
  });
}

// ── useAdvanceStage ───────────────────────────────────────────

export function useAdvanceStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      contactId,
      targetStage,
    }: {
      contactId: string;
      targetStage?: PipelineStage;
    }) =>
      apiFetch<PipelineLead>(`/${contactId}/advance`, {
        method: "PUT",
        body: JSON.stringify({ stage: targetStage }),
      }),
    onMutate: async ({ contactId, targetStage }) => {
      await queryClient.cancelQueries({ queryKey: pipelineKeys.leads() });
      const previous = queryClient.getQueryData<PipelineLead[]>(pipelineKeys.leads());

      if (previous && targetStage) {
        queryClient.setQueryData<PipelineLead[]>(
          pipelineKeys.leads(),
          previous.map((lead) =>
            lead.id === contactId ? { ...lead, stage: targetStage } : lead
          )
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(pipelineKeys.leads(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.leads() });
      queryClient.invalidateQueries({ queryKey: pipelineKeys.summary() });
    },
  });
}

// ── useAddNote ────────────────────────────────────────────────

export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddNoteInput) =>
      apiFetch<ActivityNote>(`/${input.contactId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: input.note, type: input.type ?? "NOTE" }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.activity(variables.contactId),
      });
    },
  });
}
