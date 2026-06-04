import { QueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@gi-hack/shared";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<ApiResponse<T>>;
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(path);
  return res.json() as Promise<ApiResponse<T>>;
}
