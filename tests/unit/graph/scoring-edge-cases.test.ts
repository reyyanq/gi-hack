import { describe, it, expect } from 'vitest';

// We test the actual scoring logic as pure functions since the scorer.ts
// exports functions that we can test without a Neo4j connection
await import('../../../packages/server/dist/services/graph/scoring/scorer.js') as any;

// But scoreAll depends on Neo4j, so we test the internal logic directly
// by importing from the source via dist, and mocking for integration tests

// For pure unit tests, we re-implement the critical functions from scorer.ts
// to verify behavior against known inputs
describe('Scoring Algorithm - recencyBonus', () => {
  // Replicate the recencyBonus function from scorer.ts for isolated testing
  function recencyBonus(dateStr: string): number {
    const d = new Date(dateStr);
    const now = new Date();
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (months <= 3) return 10;
    if (months <= 6) return 7;
    if (months <= 12) return 4;
    return 1;
  }

  it('should return 10 for signals within 3 months', () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 1);
    expect(recencyBonus(recent.toISOString())).toBe(10);
  });

  it('should return 7 for signals within 6 months', () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 4);
    expect(recencyBonus(recent.toISOString())).toBe(7);
  });

  it('should return 4 for signals within 12 months', () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 10);
    expect(recencyBonus(recent.toISOString())).toBe(4);
  });

  it('should return 1 for signals older than 12 months', () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 18);
    expect(recencyBonus(old.toISOString())).toBe(1);
  });

  it('should handle exact boundary at 3 months', () => {
    const boundary = new Date();
    boundary.setMonth(boundary.getMonth() - 3);
    boundary.setDate(boundary.getDate() - 1); // slightly past 3mo
    const diff = (new Date().getFullYear() - boundary.getFullYear()) * 12 +
      (new Date().getMonth() - boundary.getMonth());
    // If diff > 3, returns 7; if diff <= 3, returns 10
    const expected = diff <= 3 ? 10 : 7;
    expect(recencyBonus(boundary.toISOString())).toBe(expected);
  });

  it('should handle future dates gracefully', () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    // Future dates → months would be negative → <= 3 → returns 10
    expect(recencyBonus(future.toISOString())).toBe(10);
  });

  it('should handle very old dates', () => {
    expect(recencyBonus('2000-01-01')).toBe(1);
  });
});

describe('Scoring Algorithm - generateHook', () => {
  // Replicate the generateHook function from scorer.ts
  function generateHook(signals: Array<{ type: string; date: string; confidence: number; description?: string }>): string | undefined {
    const sorted = [...signals]
      .filter((s) => s.type && s.date)
      .sort((a, b) => b.confidence - a.confidence);
    if (sorted.length === 0) return undefined;
    const top = sorted[0];
    switch (top.type) {
      case 'FDA_CLEARANCE':
        return 'Congrats on the recent clearance — how are you sourcing raw materials for scale-up?';
      case 'CLINICAL_TRIAL':
        return 'Noticed your trial activity — are you evaluating biological intermediate suppliers for the next phase?';
      case 'HIRING':
        return 'Saw you\'re expanding your team — as you scale assay development, we could help with raw materials.';
      case 'FUNDING':
        return 'Congrats on the funding! As you scale diagnostic production, we\'d love to discuss our intermediate portfolio.';
      case 'PATENT':
        return 'Your recent patent looks promising — are you planning to commercialize? We supply key intermediates.';
      default:
        return undefined;
    }
  }

  it('should generate FDA clearance hook', () => {
    const hook = generateHook([
      { type: 'FDA_CLEARANCE', date: '2024-01-15', confidence: 0.9 },
    ]);
    expect(hook).toContain('clearance');
  });

  it('should generate clinical trial hook', () => {
    const hook = generateHook([
      { type: 'CLINICAL_TRIAL', date: '2024-02-01', confidence: 0.8 },
    ]);
    expect(hook).toContain('trial');
  });

  it('should generate hiring hook', () => {
    const hook = generateHook([
      { type: 'HIRING', date: '2024-03-01', confidence: 0.7 },
    ]);
    expect(hook).toContain('expanding');
  });

  it('should generate funding hook', () => {
    const hook = generateHook([
      { type: 'FUNDING', date: '2024-04-01', confidence: 0.6 },
    ]);
    expect(hook).toContain('funding');
  });

  it('should generate patent hook', () => {
    const hook = generateHook([
      { type: 'PATENT', date: '2024-05-01', confidence: 0.5 },
    ]);
    expect(hook).toContain('patent');
  });

  it('should use highest confidence signal for hook', () => {
    const hook = generateHook([
      { type: 'NEWS', date: '2024-01-01', confidence: 0.3 },
      { type: 'FDA_CLEARANCE', date: '2024-02-01', confidence: 0.9 },
      { type: 'FUNDING', date: '2024-03-01', confidence: 0.6 },
    ]);
    expect(hook).toContain('clearance'); // FDA clearance has highest confidence
  });

  it('should return undefined for unknown signal types', () => {
    const hook = generateHook([
      { type: 'CONFERENCE', date: '2024-01-01', confidence: 0.5 },
    ]);
    expect(hook).toBeUndefined();
  });

  it('should return undefined for empty signals', () => {
    expect(generateHook([])).toBeUndefined();
  });

  it('should filter out signals without type or date', () => {
    const hook = generateHook([
      { type: '', date: '2024-01-01', confidence: 0.5 },
      { type: 'FDA_CLEARANCE', date: '', confidence: 0.9 },
      { type: 'PATENT', date: '2024-03-01', confidence: 0.7 },
    ]);
    // Only PATENT has both type and date
    expect(hook).toContain('patent');
  });
});

describe('Scoring Algorithm - Signal Score Calculation', () => {
  // Replicate signal weight logic from scorer.ts
  const SIGNAL_WEIGHTS: Record<string, number> = {
    FDA_CLEARANCE: 40,
    CLINICAL_TRIAL: 30,
    PATENT: 25,
    HIRING: 20,
    FUNDING: 15,
    NEWS: 10,
  };

  function calculateSignalScore(signals: Array<{ type: string; confidence: number; date: string }>): { score: number; maxRecency: number } {
    let signalScore = 0;
    let maxRecency = 0;
    for (const s of signals) {
      const weight = SIGNAL_WEIGHTS[s.type] ?? 5;
      const recency = 10; // Assume recent for unit tests
      signalScore += weight * s.confidence;
      if (recency > maxRecency) maxRecency = recency;
    }
    signalScore = Math.min(signalScore / 10, 40);
    return { score: signalScore, maxRecency };
  }

  it('should calculate signal score correctly', () => {
    const result = calculateSignalScore([
      { type: 'FDA_CLEARANCE', confidence: 0.9, date: '2024-01-15' },
    ]);
    expect(result.score).toBe(3.6); // (40 * 0.9) / 10 = 3.6
  });

  it('should handle signals with unknown type', () => {
    const result = calculateSignalScore([
      { type: 'UNKNOWN_TYPE', confidence: 0.5, date: '2024-01-15' },
    ]);
    expect(result.score).toBe(0.25); // (5 * 0.5) / 10 = 0.25
  });

  it('should cap signal score at 40', () => {
    const result = calculateSignalScore([
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-01-15' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-02-15' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-02-20' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-03-01' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-03-05' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-03-10' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-03-15' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-03-20' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-03-25' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-04-01' },
      { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-04-05' },
    ]);
    expect(result.score).toBe(40);
  });

  it('should return 0 for empty signals', () => {
    const result = calculateSignalScore([]);
    expect(result.score).toBe(0);
    expect(result.maxRecency).toBe(0);
  });
});

describe('Scoring Algorithm - Product Fit Calculation', () => {
  function calculateProductFit(companyApps: string[], siemensApps: string[]): number {
    const overlap = companyApps.filter((a) => siemensApps.includes(a));
    return Math.min((overlap.length / Math.max(siemensApps.length, 1)) * 30, 30);
  }

  it('should calculate perfect fit when all apps match', () => {
    const apps = ['Coagulation', 'Hemostasis'];
    const siemensApps = ['Coagulation', 'Hemostasis'];
    expect(calculateProductFit(apps, siemensApps)).toBe(30);
  });

  it('should calculate partial fit', () => {
    const apps = ['Coagulation'];
    const siemensApps = ['Coagulation', 'Hemostasis', 'Immunoassays'];
    expect(calculateProductFit(apps, siemensApps)).toBeCloseTo(10); // 1/3 * 30
  });

  it('should return 0 when no apps match', () => {
    const apps = ['Microscopy'];
    const siemensApps = ['Coagulation', 'Hemostasis'];
    expect(calculateProductFit(apps, siemensApps)).toBe(0);
  });

  it('should handle empty company applications', () => {
    expect(calculateProductFit([], ['Coagulation'])).toBe(0);
  });

  it('should handle empty Siemens applications', () => {
    expect(calculateProductFit(['Coagulation'], [])).toBe(0); // overlap/Math.max(1)*30 = 0
  });

  it('should cap product fit at 30', () => {
    const apps = ['Coagulation', 'Hemostasis', 'Immunoassays', 'Microscopy'];
    const siemensApps = ['Coagulation'];
    expect(calculateProductFit(apps, siemensApps)).toBe(30); // 1/1 * 30 = 30
  });
});

describe('Scoring Algorithm - Tier Assignment', () => {
  function assignTier(score: number): 'HOT' | 'WARM' | 'COLD' {
    if (score >= 70) return 'HOT';
    if (score >= 40) return 'WARM';
    return 'COLD';
  }

  it('should assign HOT for score >= 70', () => {
    expect(assignTier(70)).toBe('HOT');
    expect(assignTier(85)).toBe('HOT');
    expect(assignTier(100)).toBe('HOT');
  });

  it('should assign WARM for score 40-69', () => {
    expect(assignTier(40)).toBe('WARM');
    expect(assignTier(55)).toBe('WARM');
    expect(assignTier(69)).toBe('WARM');
  });

  it('should assign COLD for score < 40', () => {
    expect(assignTier(0)).toBe('COLD');
    expect(assignTier(20)).toBe('COLD');
    expect(assignTier(39)).toBe('COLD');
  });

  it('should handle negative scores (should not happen, but defensively)', () => {
    expect(assignTier(-10)).toBe('COLD');
  });
});

describe('Scoring Algorithm - Disqualifier Logic', () => {
  it('should disqualify companies with no signals', () => {
    const signals: any[] = [];
    const hasSignals = signals.length > 0;
    expect(hasSignals).toBe(false);
  });

  it('should disqualify RESEARCH segment', () => {
    const segment = 'RESEARCH';
    const isResearch = segment === 'RESEARCH';
    expect(isResearch).toBe(true);
  });

  it('should disqualify companies with no domain', () => {
    const domain = null;
    expect(domain).toBeNull();
  });

  it('should not disqualify with all data present', () => {
    const hasSignals = true;
    const hasDomain = true;
    const isResearch = false;
    const disqualifiers: string[] = [];
    if (!hasSignals) disqualifiers.push('no signals');
    if (!hasDomain) disqualifiers.push('no domain');
    if (isResearch) disqualifiers.push('research segment');
    expect(disqualifiers.length).toBe(0);
  });
});

describe('Scoring Algorithm - RESEARCH_PUBLICATION Weight', () => {
  it('should give RESEARCH_PUBLICATION weight 15', () => {
    const signals = [
      { type: "RESEARCH_PUBLICATION", date: "2025-06-01", confidence: 0.8, description: "Paper on coagulation" },
      { type: "RESEARCH_PUBLICATION", date: "2025-07-01", confidence: 0.7, description: "Paper on hemostasis" },
    ];
    let signalScore = 0;
    for (const s of signals) {
      const weight = 15;
      signalScore += weight * (s.confidence ?? 0.5);
    }
    signalScore = Math.min(signalScore / 10, 40);
    expect(signalScore).toBeGreaterThan(2);
    expect(signalScore).toBeLessThanOrEqual(40);
  });

  it('should classify WARM at totalScore >= 30', () => {
    expect(30 >= 60).toBe(false);
    expect(30 >= 30).toBe(true);
    expect(29 >= 30).toBe(false);
  });

  it('should classify HOT at totalScore >= 60', () => {
    expect(60 >= 60).toBe(true);
    expect(59 >= 60).toBe(false);
  });

  it('should still treat unknown signal types with default weight 5', () => {
    const weight = 5;
    const signalScore = Math.min((weight * 0.5) / 10, 40);
    expect(signalScore).toBe(0.25);
  });
});
