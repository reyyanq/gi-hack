export { type SourceAdapter, type RawLead, type LeadCandidate, type Signal, type SignalType } from "./types.js";
export { type SourceConfig, type IngestionSummary, type SeedSummary } from "./types.js";
export { type TierLevel, type ScoredCompany, type ScoreBreakdown, type Disqualifier } from "./types.js";
export { seedGraph } from "./ontology.js";
export { createJob, startJob, completeJob, completeAdapter, failJob, getJob } from "./job-tracker.js";
export type { IngestJob, JobStatus } from "./job-tracker.js";
import { runQuery } from "../neo4j.js";
import { SourceManager } from "./orchestrator.js";
export { SourceManager };
import { createJob, startJob, completeJob, completeAdapter, failJob, getJob } from "./job-tracker.js";

import { FDA510kAdapter } from "./adapters/fda-510k.js";
import { GitHubSourceAdapter } from "./adapters/github.js";
import { ClinicalTrialsAdapter } from "./adapters/clinical-trials.js";
import { OpenAlexAdapter } from "./adapters/openalex.js";
import { DRKSAdapter } from "./adapters/drks.js";
import { EPatentAdapter } from "./adapters/epatent.js";
import { MedicaAdapter } from "./adapters/medica.js";
import { FoekatAdapter } from "./adapters/foekat.js";
import { MDALLAdapter } from "./adapters/mdall.js";
import { MFDSAdapter } from "./adapters/mfds.js";
import { NMPAAdapter } from "./adapters/nmpa.js";
import { TGAAdapter } from "./adapters/tga.js";
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
    managerInstance.register(new OpenAlexAdapter(), { weight: 28 });
    managerInstance.register(new EPatentAdapter(), { weight: 23 });
    managerInstance.register(new DRKSAdapter(), { weight: 22 });
    managerInstance.register(new PatentStubAdapter(), { weight: 25 });
    managerInstance.register(new HiringStubAdapter(), { weight: 20 });
    managerInstance.register(new MedicaAdapter(), { weight: 18 });
    managerInstance.register(new FoekatAdapter(), { weight: 15 });
    managerInstance.register(new MDALLAdapter(), { weight: 25 });
    managerInstance.register(new MFDSAdapter(), { weight: 25 });
    managerInstance.register(new NMPAAdapter(), { weight: 25 });
    managerInstance.register(new TGAAdapter(), { weight: 25 });
    managerInstance.register(new ConferenceStubAdapter(), { weight: 15 });
    managerInstance.register(new FundingStubAdapter(), { weight: 10 });
  }
  return managerInstance;
}

export async function runAllIngestion(): Promise<{
  jobId: string;
  results: any[];
  companiesCreatedOrUpdated: number;
  duration: number;
}> {
  const orchestrator = getOrchestrator();
  const total = orchestrator.getRegistered().length;
  const jobId = createJob(total);
  startJob(jobId);
  const startTime = Date.now();

  orchestrator.runAll((summary) => completeAdapter(jobId, summary))
    .then(() => completeJob(jobId))
    .catch((err) => failJob(jobId, err instanceof Error ? err.message : String(err)));

  const duration = Date.now() - startTime;
  const completedJob = await new Promise<any>((resolve) => {
    const poll = setInterval(() => {
      const job = getJob(jobId);
      if (job?.status === "completed" || job?.status === "failed") {
        clearInterval(poll);
        resolve(job);
      }
    }, 500);
  });

  return {
    jobId,
    results: completedJob.adapters,
    companiesCreatedOrUpdated: completedJob.adapters.reduce((sum: number, a: any) => sum + (a.companiesCreatedOrUpdated ?? 0), 0),
    duration,
  };
}

export async function truncateGraph(): Promise<{ nodesDeleted: number }> {
  const result = await runQuery(
    `MATCH (n)
     WHERE n:Company OR n:Signal OR n:Product OR n:Application
     DETACH DELETE n
     RETURN count(n) AS nodesDeleted`
  );
  const nodesDeleted = Number((result.records?.[0] as any)?.["nodesDeleted"] ?? 0);
  return { nodesDeleted };
}
