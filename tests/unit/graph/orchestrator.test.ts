import { describe, it, expect } from 'vitest';

const { normalizeCompanyName } = await import('../../../packages/server/dist/services/graph/ingest/orchestrator.js') as any;

describe('Orchestrator - Company Name Normalization', () => {
  describe('normalizeCompanyName', () => {
    it('should strip common legal suffixes', () => {
      expect(normalizeCompanyName('BioTech Solutions GmbH')).toBe('biotech solutions');
      expect(normalizeCompanyName('Diagnostics AG')).toBe('diagnostics');
      expect(normalizeCompanyName('LabCorp Ltd')).toBe('labcorp');
      expect(normalizeCompanyName('MedCo Inc')).toBe('medco');
      expect(normalizeCompanyName('PharmaCorp LLC')).toBe('pharmacorp');
      expect(normalizeCompanyName('HealthTech Corporation')).toBe('healthtech');
      expect(normalizeCompanyName('BioLabs Pty Ltd')).toBe('biolabs');
      expect(normalizeCompanyName('Research Labs PLC')).toBe('research labs');
    });

    it('should strip German compound suffixes', () => {
      expect(normalizeCompanyName('Firma GmbH & Co. KG')).toBe('firma');
      expect(normalizeCompanyName('Firma GmbH & Co. kg')).toBe('firma');
      expect(normalizeCompanyName('Firma GmbH und Co KG')).toBe('firma');
      expect(normalizeCompanyName('Firma GmbH & Co')).toBe('firma');
    });

    it('should strip parenthetical content', () => {
      expect(normalizeCompanyName('BioTech Solutions (formerly OldName) GmbH')).toBe('biotech solutions');
      expect(normalizeCompanyName('Company (UK) Ltd')).toBe('company');
      expect(normalizeCompanyName('Test (Group) Holding')).toBe('test');
    });

    it('should handle multiple nested suffixes', () => {
      expect(normalizeCompanyName('Advanced Diagnostics GmbH & Co. KG')).toBe('advanced diagnostics');
      expect(normalizeCompanyName('Global Health Solutions Ltd (Europe) Group')).toBe('global health solutions');
    });

    it('should lower case and remove special characters', () => {
      expect(normalizeCompanyName('Bio-Tech Solutions!')).toBe('bio-tech solutions');
      expect(normalizeCompanyName('R&D Diagnostics, Inc.')).toBe('rd diagnostics');
    });

    it('should collapse whitespace', () => {
      expect(normalizeCompanyName('  BioTech   Solutions  GmbH  ')).toBe('biotech solutions');
    });

    it('should handle commas in company names', () => {
      expect(normalizeCompanyName('Siemens Healthineers, AG')).toBe('siemens healthineers');
    });

    it('should keep hyphens in names', () => {
      expect(normalizeCompanyName('Bio-Tech-Med GmbH')).toBe('bio-tech-med');
    });

    it('should not strip legal suffixes that are part of the name', () => {
      expect(normalizeCompanyName('The Binding Site Group')).toBe('the binding site');
    });

    it('should handle empty or near-empty input', () => {
      expect(normalizeCompanyName('')).toBe('');
      expect(normalizeCompanyName('   ')).toBe('');
      expect(normalizeCompanyName('(empty)')).toBe('');
    });

    it('should strip "Group" suffix', () => {
      expect(normalizeCompanyName('BioTech Group')).toBe('biotech');
      expect(normalizeCompanyName('Health Holdings')).toBe('health');
      expect(normalizeCompanyName('Med Holding')).toBe('med');
    });

    it('should handle "Limited" suffix', () => {
      expect(normalizeCompanyName('BioTech Limited')).toBe('biotech');
    });

    it('should handle international company names', () => {
      expect(normalizeCompanyName('上海医药集团有限公司')).toBe('上海医药集团有限公司');
      expect(normalizeCompanyName('Université de Paris')).toBe('université de paris');
    });
  });
});

describe('Orchestrator - Signal Deduplication (mergeSignals)', () => {
  it('should deduplicate signals by type+date+description', () => {
    const candidates = [
      {
        sourceId: 'fda-510k',
        companyName: 'Test Company',
        signals: [
          { type: 'FDA_CLEARANCE', date: '2024-01-15', confidence: 0.9, description: 'FDA clearance for hemostasis assay' },
          { type: 'CLINICAL_TRIAL', date: '2024-02-01', confidence: 0.8, description: 'Phase 2 trial for coagulation disorder' },
        ],
      },
      {
        sourceId: 'clinical-trials',
        companyName: 'Test Company',
        signals: [
          { type: 'CLINICAL_TRIAL', date: '2024-02-01', confidence: 0.8, description: 'Phase 2 trial for coagulation disorder' },
          { type: 'PATENT', date: '2024-03-01', confidence: 0.7, description: 'Patent for novel diagnostic method' },
        ],
      },
    ];

    const seenSignals = new Set<string>();
    const merged: any[] = [];
    for (const c of candidates) {
      for (const s of c.signals) {
        const key = `${s.type}::${s.date}::${s.description.slice(0, 80)}`;
        if (!seenSignals.has(key)) {
          seenSignals.add(key);
          merged.push(s);
        }
      }
    }

    expect(merged.length).toBe(3);
    expect(merged.filter((s) => s.type === 'CLINICAL_TRIAL').length).toBe(1);
    expect(merged.map((s) => s.type)).toContain('FDA_CLEARANCE');
    expect(merged.map((s) => s.type)).toContain('CLINICAL_TRIAL');
    expect(merged.map((s) => s.type)).toContain('PATENT');
  });

  it('should keep signals with same type/date but different descriptions', () => {
    const signals = [
      { type: 'FDA_CLEARANCE', date: '2024-01-15', description: 'Clearance for hemostasis assay kit A' },
      { type: 'FDA_CLEARANCE', date: '2024-01-15', description: 'Clearance for hemostasis assay kit B' },
    ];

    const seenSignals = new Set<string>();
    const merged: any[] = [];
    for (const s of signals) {
      const key = `${s.type}::${s.date}::${s.description.slice(0, 80)}`;
      if (!seenSignals.has(key)) {
        seenSignals.add(key);
        merged.push(s);
      }
    }

    expect(merged.length).toBe(2);
  });
});
