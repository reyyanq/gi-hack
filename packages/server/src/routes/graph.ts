import { Router, Request, Response } from "express";
import { runQuery, verifyConnection } from "../services/graph/neo4j.js";
import { seedGraph, truncateGraph, getOrchestrator } from "../services/graph/ingest/index.js";
import { createJob, startJob, completeJob, completeAdapter, failJob, getJob } from "../services/graph/ingest/job-tracker.js";
import { triggerIngestionNow } from "../services/scheduler.js";

const router = Router();

router.post("/query", async (req: Request, res: Response) => {
  try {
    const { cypher, params } = req.body;
    if (!cypher || typeof cypher !== "string") {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_INPUT", message: "cypher field is required" },
      });
      return;
    }
    const result = await runQuery(cypher, params ?? {});
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "GRAPH_QUERY_FAILED", message } });
  }
});

router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const result = await seedGraph();
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "SEED_FAILED", message } });
  }
});

router.get("/health", async (_req: Request, res: Response) => {
  const connected = await verifyConnection();
  res.json({ ok: true, data: { connected } });
});

router.post("/ingest", (req: Request, res: Response) => {
  const source = req.query.source as string | undefined;
  const orchestrator = getOrchestrator();

  if (source) {
    // Single source — run synchronously (fast)
    orchestrator.runSingle(source)
      .then((result) => res.json({ ok: true, data: { ingestion: [result], source } }))
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ ok: false, error: { code: "INGEST_FAILED", message } });
      });
  } else {
    // Full ingest — run in background with progress tracking
    const total = orchestrator.getRegistered().length;
    const jobId = createJob(total);
    startJob(jobId);

    orchestrator.runAll((summary) => completeAdapter(jobId, summary))
      .then(() => {
        completeJob(jobId);
      })
      .catch((err) => {
        failJob(jobId, err instanceof Error ? err.message : String(err));
      });

    res.json({ ok: true, data: { jobId } });
  }
});

router.get("/ingest/status/:jobId", (req: Request, res: Response) => {
  const jobId = req.params.jobId as string;
  const job = getJob(jobId);
  if (!job) {
    res.status(404).json({ ok: false, error: { code: "JOB_NOT_FOUND", message: `No ingest job "${jobId}"` } });
    return;
  }
  res.json({ ok: true, data: job });
});

router.delete("/ingest", async (_req: Request, res: Response) => {
  try {
    const result = await truncateGraph();
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "TRUNCATE_FAILED", message } });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [companies, products, applications, signals, relationships] = await Promise.all([
      runQuery("MATCH (c:Company) RETURN count(c) AS count"),
      runQuery("MATCH (p:Product) RETURN count(p) AS count"),
      runQuery("MATCH (a:Application) RETURN count(a) AS count"),
      runQuery("MATCH (s:Signal) RETURN count(s) AS count"),
      runQuery("MATCH ()-[r]->() RETURN count(r) AS count"),
    ]);
    res.json({
      ok: true,
      data: {
        companies: Number(companies.records?.[0]?.count ?? 0),
        products: Number(products.records?.[0]?.count ?? 0),
        applications: Number(applications.records?.[0]?.count ?? 0),
        signals: Number(signals.records?.[0]?.count ?? 0),
        totalRelationships: Number(relationships.records?.[0]?.count ?? 0),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "STATS_FAILED", message } });
  }
});

router.get("/ingest/sources", async (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  const names = orchestrator.getRegistered();
  const health = await orchestrator.getRegisteredHealth();
  res.json({ ok: true, data: { sources: names, health } });
});

router.post("/validate-domains", async (_req: Request, res: Response) => {
  try {
    const { validateAllDomains } = await import("../services/graph/domain-validator.js");
    const result = await validateAllDomains();
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "VALIDATION_FAILED", message } });
  }
});

router.post("/enrich-domains", async (_req: Request, res: Response) => {
  try {
    const { enrichDomains } = await import("../services/graph/domain-finder.js");
    const { limit, concurrency } = _req.body ?? {};
    const result = await enrichDomains({ limit, concurrency });
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "DOMAIN_ENRICH_FAILED", message } });
  }
});

router.get("/score", async (_req: Request, res: Response) => {
  try {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const companies = await scoreAll();
    const total = companies.length;
    const hot = companies.filter((c) => c.tier === "HOT").length;
    const warm = companies.filter((c) => c.tier === "WARM").length;
    const cold = companies.filter((c) => c.tier === "COLD").length;
    const avgScore = total > 0 ? Math.round(companies.reduce((s, c) => s + c.totalScore, 0) / total) : 0;
    res.json({
      ok: true,
      data: { companies, summary: { total, hot, warm, cold, avgScore } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "SCORING_FAILED", message } });
  }
});

router.post("/classify-segments", async (_req: Request, res: Response) => {
  try {
    const { classifyAllSegments } = await import("../services/graph/scoring/segment-classifier.js");
    const { limit, concurrency } = _req.body ?? {};
    const result = await classifyAllSegments({ limit, concurrency });
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "SEGMENT_CLASSIFY_FAILED", message } });
  }
});

router.post("/score/run", async (_req: Request, res: Response) => {
  try {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const companies = await scoreAll();
    res.json({ scored: companies.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "SCORE_RUN_FAILED", message } });
  }
});

router.post("/cron/ingest", async (_req: Request, res: Response) => {
  try {
    const result = await triggerIngestionNow();
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "CRON_INGEST_FAILED", message } });
  }
});

export default router;
