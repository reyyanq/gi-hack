import { useQuery, useMutation } from "@tanstack/react-query";
import { apiPost, apiGet, queryClient } from "./api";

export function useGraphHealth() {
  return useQuery({
    queryKey: ["graph", "health"],
    queryFn: () => apiGet<{ connected: boolean }>("/api/graph/health"),
  });
}

export function useGraphQuery() {
  return useMutation({
    mutationFn: (cypher: string) =>
      apiPost<{ records: unknown[]; summary: unknown }>("/api/graph/query", {
        cypher,
      }),
  });
}

export function useGraphSeed() {
  return useMutation({
    mutationFn: () => apiPost<{ message: string; nodesSeeded: number }>("/api/graph/seed", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}
