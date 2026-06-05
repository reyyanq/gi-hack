import { Router, Request, Response } from "express";
import { runQuery, verifyConnection } from "../services/graph/neo4j.js";
import { seedGraph, getOrchestrator } from "../services/graph/ingest/index.js";

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

router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const source = req.query.source as string | undefined;
    const orchestrator = getOrchestrator();
    const result = source
      ? await orchestrator.runSingle(source)
      : await orchestrator.runAll();
    res.json({ ok: true, data: { ingestion: result } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "INGEST_FAILED", message } });
  }
});

router.get("/ingest/sources", async (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  res.json({ ok: true, data: { sources: orchestrator.getRegistered() } });
});

router.get("/score", async (_req: Request, res: Response) => {
  try {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const results = await scoreAll();
    res.json({ ok: true, data: { companies: results } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "SCORING_FAILED", message } });
  }
});

export default router;
