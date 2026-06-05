export { type SourceAdapter, type RawLead, type LeadCandidate, type Signal, type SignalType } from "./types.js";
export { type SourceConfig, type IngestionSummary, type SeedSummary } from "./types.js";
export { type TierLevel, type ScoredCompany, type ScoreBreakdown, type Disqualifier } from "./types.js";
export { seedGraph } from "./ontology.js";
import { runQuery } from "../neo4j.js";
import { SourceManager } from "./orchestrator.js";
export { SourceManager };

import { FDA510kAdapter } from "./adapters/fda-510k.js";
import { GitHubSourceAdapter } from "./adapters/github.js";
import { ClinicalTrialsAdapter } from "./adapters/clinical-trials.js";
import { PatentStubAdapter } from "./adapters/patent-stub.js";
import { HiringStubAdapter } from "./adapters/hiring-stub.js";
import { ConferenceStubAdapter } from "./adapters/conference-stub.js";
import { FundingStubAdapter } from "./adapters/funding-stub.js";

let managerInstance: SourceManager | null = null;

export function getOrchestrator(): SourceManager {
  if (!managerInstance) {
    managerInstance = new SourceManager(3);
    managerInstance.register(new FDA510kAdapter(), { weight: 50 });
    managerInstance.register(new GitHubSourceAdapter(process.env.GITHUB_TOKEN), { weight: 40 });
    managerInstance.register(new ClinicalTrialsAdapter(), { weight: 30 });
    managerInstance.register(new PatentStubAdapter(), { weight: 25 });
    managerInstance.register(new HiringStubAdapter(), { weight: 20 });
    managerInstance.register(new ConferenceStubAdapter(), { weight: 15 });
    managerInstance.register(new FundingStubAdapter(), { weight: 10 });
  }
  return managerInstance;
}

export async function truncateGraph(): Promise<{ nodesDeleted: number }> {
  const result = await runQuery(
    `MATCH (n)
     WHERE n:Company OR n:Signal OR n:Product OR n:Application
     DETACH DELETE n
     RETURN count(n) AS nodesDeleted`
  );
  const nodesDeleted = Number(result.records?.[0]?.get("nodesDeleted") ?? 0);
  return { nodesDeleted };
}
