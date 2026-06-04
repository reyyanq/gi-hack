import { Router, Request, Response } from "express";
import { runQuery, verifyConnection } from "../services/graph/neo4j.js";

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
    const seedQueries = [
      `CREATE (p:Person {name: "Alice", role: "Developer"})`,
      `CREATE (p:Person {name: "Bob", role: "Designer"})`,
      `CREATE (p:Person {name: "Charlie", role: "PM"})`,
      `CREATE (p:Project {name: "Hackathon App", status: "Active"})`,
      `MATCH (a:Person {name: "Alice"}), (b:Person {name: "Bob"})
       CREATE (a)-[:COLLABORATES_WITH]->(b)`,
      `MATCH (a:Person {name: "Alice"}), (p:Project {name: "Hackathon App"})
       CREATE (a)-[:WORKS_ON]->(p)`,
      `MATCH (b:Person {name: "Bob"}), (p:Project {name: "Hackathon App"})
       CREATE (b)-[:WORKS_ON]->(p)`,
    ];

    for (const cypher of seedQueries) {
      await runQuery(cypher);
    }

    res.json({ ok: true, data: { message: "Seed data created", nodesSeeded: 7 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      ok: false,
      error: { code: "GRAPH_SEED_FAILED", message },
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
