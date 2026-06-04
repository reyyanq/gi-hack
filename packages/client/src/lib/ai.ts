import { useMutation } from "@tanstack/react-query";
import { apiPost } from "./api";

export function useAskAI() {
  return useMutation({
    mutationFn: (params: { prompt: string; useGraphContext?: boolean }) =>
      apiPost<{ answer: string }>("/api/ai/ask", params),
  });
}
