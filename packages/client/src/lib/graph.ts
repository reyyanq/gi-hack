import { useQuery, useMutation } from "@tanstack/react-query";
import { apiPost, apiGet, queryClient } from "./api";

export function useGraphHealth() {
  return useQuery({
    queryKey: ["graph", "health"],
    queryFn: async () => {
      const res = await apiGet<{ connected: boolean }>("/api/graph/health");
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useGraphQuery() {
  return useMutation({
    mutationFn: async (cypher: string) => {
      const res = await apiPost<{ records: unknown[]; summary: unknown }>("/api/graph/query", { cypher });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useGraphSeed() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiPost<Record<string, unknown>>("/api/graph/seed", {});
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}
