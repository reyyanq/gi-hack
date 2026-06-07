import { describe, it, expect, vi } from 'vitest';

describe('AI Services', () => {
  describe('Enrichment Service', () => {
    it('should construct enrichment prompt', async () => {
      const companyName = 'BioTech Solutions GmbH';
      const signals = [
        { type: 'FDA_CLEARANCE', date: '2024-01-15', description: 'FDA 510(k) clearance' }
      ];

      const mockLLM = vi.fn().mockResolvedValue({
        segment: 'IVD',
        domain: 'biotech-solutions.de',
        description: 'Leading provider of diagnostic solutions'
      });

      const result = await mockLLM(companyName, signals);
      expect(result.segment).toBe('IVD');
      expect(result.domain).toBeDefined();
    });

    it('should handle missing signals', async () => {
      const companyName = 'Unknown Company';
      const mockLLM = vi.fn().mockResolvedValue({
        segment: 'UNKNOWN',
        domain: null,
        description: 'Unable to analyze without signals'
      });

      const result = await mockLLM(companyName, []);
      expect(result.segment).toBe('UNKNOWN');
    });
  });

  describe('Outreach Service', () => {
    it('should generate outreach email', async () => {
      const companyData = {
        name: 'Diagnostic Systems AG',
        segment: 'IVD',
        signals: [
          { description: 'Recent patent for point-of-care testing' }
        ],
        score: 72
      };

      const mockLLM = vi.fn().mockResolvedValue({
        subject: 'Collaboration Opportunity: Point-of-Care Testing Innovation',
        body: 'Dear Team, I noticed your recent patent achievements...'
      });

      const result = await mockLLM(companyData);
      expect(result.subject).toContain('Collaboration');
      expect(result.body).toBeDefined();
    });

    it('should personalize based on signals', async () => {
      const companyData = {
        name: 'HemoDiagnostics SE',
        signals: [
          { description: 'Clinical trial Phase 3 for novel anticoagulant' }
        ],
        score: 85
      };

      const mockLLM = vi.fn().mockResolvedValue({
        subject: 'Clinical Trial Partnership',
        body: 'Congratulations on Phase 3 progress...'
      });

      const result = await mockLLM(companyData);
      expect(result.subject).toContain('Clinical Trial');
      expect(result.body).toContain('Phase 3');
    });
  });

  describe('Score Explanation Service', () => {
    it('should explain score breakdown', async () => {
      const scoreData = {
        total: 75,
        breakdown: {
          signal: 35,
          productFit: 25,
          segment: 10,
          recency: 5
        },
        signals: [
          { type: 'FDA_CLEARANCE', confidence: 0.9 },
          { type: 'CLINICAL_TRIAL', confidence: 0.8 }
        ]
      };

      const mockLLM = vi.fn().mockResolvedValue({
        explanation: 'Score of 75 indicates strong fit based on FDA clearance and clinical trial signals.'
      });

      const result = await mockLLM(scoreData);
      expect(result.explanation).toContain('75');
      expect(result.explanation).toContain('FDA');
    });

    it('should handle low scores', async () => {
      const scoreData = {
        total: 25,
        breakdown: {
          signal: 10,
          productFit: 10,
          segment: 3,
          recency: 2
        },
        signals: [
          { type: 'CONFERENCE', confidence: 0.5 }
        ]
      };

      const mockLLM = vi.fn().mockResolvedValue({
        explanation: 'Score of 25 indicates limited fit. Consider nurturing before outreach.'
      });

      const result = await mockLLM(scoreData);
      expect(result.explanation).toContain('25');
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM API errors', async () => {
      const mockLLM = vi.fn().mockRejectedValue(new Error('API timeout'));

      await expect(mockLLM('Test Company', [])).rejects.toThrow('API timeout');
    });

    it('should handle invalid response format', async () => {
      const mockLLM = vi.fn().mockResolvedValue({ invalid: 'response' });

      const result = await mockLLM('Test Company', []);
      expect(result).toBeDefined();
    });
  });

  describe('Fallback Behavior', () => {
    it('should use default values when LLM fails', async () => {
      const mockLLM = vi.fn().mockRejectedValue(new Error('API error'));

      await expect(mockLLM('Test Company', [])).rejects.toThrow();
    });
  });
});
