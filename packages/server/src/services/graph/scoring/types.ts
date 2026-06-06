export interface ContactInfo {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface ScoredResult {
  companyName: string;
  domain?: string;
  segment?: string;
  region?: string;
  tier: "HOT" | "WARM" | "COLD";
  totalScore: number;
  breakdown: {
    signalScore: number;
    productFitScore: number;
    segmentBonus: number;
    recencyBonus: number;
  };
  disqualifiers: string[];
  outreachHook?: string;
  contacts: ContactInfo[];
  signals: Array<{
    type: string;
    date: string;
    confidence: number;
    description: string;
  }>;
  applications?: string[];
}
