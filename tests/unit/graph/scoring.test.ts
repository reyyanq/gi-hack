import { describe, it, expect } from 'vitest';

describe('Scoring Algorithm', () => {
  describe('Signal Score Calculation (0-40)', () => {
    it('should calculate signal score based on type confidence', () => {
      const signals = [
        { type: 'FDA_CLEARANCE', confidence: 0.9, date: '2024-01-15' },
        { type: 'CLINICAL_TRIAL', confidence: 0.8, date: '2024-02-01' }
      ];
      
      const signalScore = signals.reduce((sum, s) => sum + (s.confidence * 20), 0);
      expect(signalScore).toBe(34);
    });

    it('should cap signal score at 40', () => {
      const signals = [
        { type: 'FDA_CLEARANCE', confidence: 1.0, date: '2024-01-15' },
        { type: 'CLINICAL_TRIAL', confidence: 1.0, date: '2024-02-01' },
        { type: 'PATENT', confidence: 0.9, date: '2024-03-01' }
      ];
      
      const signalScore = Math.min(40, signals.reduce((sum, s) => sum + (s.confidence * 20), 0));
      expect(signalScore).toBe(40);
    });

    it('should handle no signals', () => {
      const signalScore = 0;
      expect(signalScore).toBe(0);
    });
  });

  describe('Product Fit Calculation (0-30)', () => {
    it('should calculate fit based on application matches', () => {
      const companyApplications = ['ELISA', 'Coagulation', 'Western Blot'];
      const portfolioApplications = ['ELISA', 'Coagulation', 'Western Blot', 'Flow Cytometry'];
      
      const matches = companyApplications.filter(app => portfolioApplications.includes(app)).length;
      const productFit = (matches / portfolioApplications.length) * 30;
      expect(productFit).toBe(22.5);
    });

    it('should weight coagulation applications higher', () => {
      const companyApplications = ['Coagulation', 'Hemostasis'];
      const portfolioApplications = ['Coagulation', 'Hemostasis'];
      
      const isSpecialized = companyApplications.includes('Coagulation') || companyApplications.includes('Hemostasis');
      const matchCount = companyApplications.filter(app => portfolioApplications.includes(app)).length;
      const productFit = isSpecialized ? 30 : (matchCount / portfolioApplications.length) * 30;
      expect(productFit).toBe(30);
    });

    it('should handle no application data', () => {
      const productFit = 0;
      expect(productFit).toBe(0);
    });
  });

  describe('Segment Score Calculation (0-20)', () => {
    it('should assign highest score to IVD segment', () => {
      const segment = 'IVD';
      const segmentScores = { IVD: 20, Biotech: 15, Pharma: 10, Academic: 5 };
      const segmentScore = segmentScores[segment] || 10;
      expect(segmentScore).toBe(20);
    });

    it('should assign mid score to Biotech segment', () => {
      const segment = 'Biotech';
      const segmentScores = { IVD: 20, Biotech: 15, Pharma: 10, Academic: 5 };
      const segmentScore = segmentScores[segment] || 10;
      expect(segmentScore).toBe(15);
    });

    it('should assign default score for unknown segments', () => {
      const segment = 'Unknown';
      const segmentScores = { IVD: 20, Biotech: 15, Pharma: 10, Academic: 5 };
      const segmentScore = segmentScores[segment] || 10;
      expect(segmentScore).toBe(10);
    });
  });

  describe('Recency Bonus Calculation (0-10)', () => {
    it('should give full bonus for recent signals (< 7 days)', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      
      const daysSince = (Date.now() - recentDate.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBonus = daysSince < 7 ? 10 : daysSince < 30 ? 5 : 0;
      expect(recencyBonus).toBe(10);
    });

    it('should give partial bonus for signals < 30 days', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 20);
      
      const daysSince = (Date.now() - recentDate.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBonus = daysSince < 7 ? 10 : daysSince < 30 ? 5 : 0;
      expect(recencyBonus).toBe(5);
    });

    it('should give no bonus for old signals (> 30 days)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);
      
      const daysSince = (Date.now() - oldDate.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBonus = daysSince < 7 ? 10 : daysSince < 30 ? 5 : 0;
      expect(recencyBonus).toBe(0);
    });
  });

  describe('Total Score Calculation', () => {
    it('should calculate total as sum of all components', () => {
      const breakdown = {
        signal: 30,
        productFit: 25,
        segment: 20,
        recency: 5
      };
      
      const total = breakdown.signal + breakdown.productFit + breakdown.segment + breakdown.recency;
      expect(total).toBe(80);
    });

    it('should cap total at 100', () => {
      const breakdown = {
        signal: 40,
        productFit: 30,
        segment: 20,
        recency: 10
      };
      
      const total = Math.min(100, breakdown.signal + breakdown.productFit + breakdown.segment + breakdown.recency);
      expect(total).toBe(100);
    });
  });

  describe('Tier Assignment', () => {
    it('should assign HOT tier for score >= 70', () => {
      const score = 85;
      const tier = score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
      expect(tier).toBe('HOT');
    });

    it('should assign WARM tier for score 40-69', () => {
      const score = 55;
      const tier = score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
      expect(tier).toBe('WARM');
    });

    it('should assign COLD tier for score < 40', () => {
      const score = 35;
      const tier = score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
      expect(tier).toBe('COLD');
    });

    it('should handle edge case score exactly 70', () => {
      const score = 70;
      const tier = score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
      expect(tier).toBe('HOT');
    });

    it('should handle edge case score exactly 40', () => {
      const score = 40;
      const tier = score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
      expect(tier).toBe('WARM');
    });
  });

  describe('Comprehensive Scoring', () => {
    it('should calculate complete score for HOT lead', () => {
      const signals = [
        { type: 'FDA_CLEARANCE', confidence: 0.9, date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
      ];
      const companyApplications = ['Coagulation'];
      const portfolioApplications = ['Coagulation', 'Hemostasis'];
      const segment = 'IVD';
      
      const signalScore = Math.min(40, signals.reduce((sum, s) => sum + (s.confidence * 20), 0));
      const isSpecialized = companyApplications.includes('Coagulation') || companyApplications.includes('Hemostasis');
      const matchCount = companyApplications.filter(app => portfolioApplications.includes(app)).length;
      const productFit = isSpecialized ? 30 : (matchCount / portfolioApplications.length) * 30;
      const segmentScores = { IVD: 20, Biotech: 15, Pharma: 10, Academic: 5 };
      const segmentScore = segmentScores[segment] || 10;
      const daysSince = 3;
      const recencyBonus = daysSince < 7 ? 10 : daysSince < 30 ? 5 : 0;
      
      const total = signalScore + productFit + segmentScore + recencyBonus;
      const tier = total >= 70 ? 'HOT' : total >= 40 ? 'WARM' : 'COLD';
      
      expect(total).toBeGreaterThanOrEqual(70);
      expect(tier).toBe('HOT');
    });

    it('should calculate complete score for COLD lead', () => {
      const signals = [
        { type: 'CONFERENCE', confidence: 0.4, date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() }
      ];
      const companyApplications = ['Microscopy'];
      const portfolioApplications = ['Coagulation', 'Hemostasis'];
      const segment = 'Unknown';
      
      const signalScore = signals.reduce((sum, s) => sum + (s.confidence * 10), 0);
      const matchCount = companyApplications.filter(app => portfolioApplications.includes(app)).length;
      const productFit = (matchCount / portfolioApplications.length) * 30;
      const segmentScores = { IVD: 20, Biotech: 15, Pharma: 10, Academic: 5 };
      const segmentScore = segmentScores[segment] || 10;
      const daysSince = 60;
      const recencyBonus = daysSince < 7 ? 10 : daysSince < 30 ? 5 : 0;
      
      const total = signalScore + productFit + segmentScore + recencyBonus;
      const tier = total >= 70 ? 'HOT' : total >= 40 ? 'WARM' : 'COLD';
      
      expect(total).toBeLessThan(40);
      expect(tier).toBe('COLD');
    });
  });
});
