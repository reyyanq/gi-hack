import { Router, Request, Response } from "express";
import { runQuery, verifyConnection } from "../services/graph/neo4j.js";
import { seedGraph } from "../services/graph/ingest/ontology.js";

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
    res.status(500).json({
      ok: false,
      error: { code: "GRAPH_QUERY_FAILED", message },
    });
  }
});

router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const result = await seedGraph();
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({
      ok: true,
      data: { note: "Ontology seed not yet implemented", message },
    });
  }
});

router.get("/health", async (_req: Request, res: Response) => {
  const connected = await verifyConnection();
  res.json({
    ok: true,
    data: { connected },
  });
});

export default router;
