import { useMutation, useQuery } from '@tanstack/react-query';

const API_BASE = 'http://localhost:3001/api/ai';

/**
 * Hook to trigger automated AI Enrichment for missing target company metadata.
 */
export function useEnrichCompany() {
  return useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`${API_BASE}/enrich/${companyId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Company enrichment execution failed');
      return res.json();
    },
  });
}

/**
 * Hook to generate customized, high-conversion cold emails mapped to driving triggers.
 */
export function useGenerateOutreach() {
  return useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`${API_BASE}/outreach/${companyId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Outreach copy generation failed');
      return res.json();
    },
  });
}

/**
 * Hook to retrieve human-readable business context justifications for the underlying lead scores.
 */
export function useScoreExplanation(companyId: string) {
  return useQuery({
    queryKey: ['scoreExplanation', companyId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/explain/${companyId}`);
      if (!res.ok) throw new Error('Failed to fetch lead score breakdown justification');
      return res.json();
    },
    enabled: !!companyId, // Prevents execution until an explicit company identity context is set
  });
}
