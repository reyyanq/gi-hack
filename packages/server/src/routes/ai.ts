import { Router, Request, Response } from "express";
import { askAI, isConfigured } from "../services/ai/llm.js";
import { runQuery } from "../services/graph/neo4j.js";

const router = Router();

router.post("/ask", async (req: Request, res: Response) => {
  try {
    const { prompt, useGraphContext } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_INPUT", message: "prompt field is required" },
      });
      return;
    }

    if (!apiKey || !isConfigured(apiKey)) {
      res.status(503).json({
        ok: false,
        error: {
          code: "AI_NOT_CONFIGURED",
          message: "OPENAI_API_KEY is not set or is a placeholder. Copy .env.example to .env and add your key.",
        },
      });
      return;
    }

    let context: string | undefined;
    if (useGraphContext) {
      try {
        const result = await runQuery(
          "MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50"
        );
        context = JSON.stringify(result.records.slice(0, 10));
      } catch {
        context = "Graph database unavailable";
      }
    }

    const answer = await askAI(apiKey, prompt, context);
    res.json({ ok: true, data: { answer } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "AI_QUERY_FAILED", message },
    });
  }
});

export default router;
