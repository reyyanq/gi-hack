export interface ScoredResult {
  companyName: string;
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
}
