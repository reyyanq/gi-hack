import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";
import apiRouter from "./routes/api.js";
import { createDriver, closeDriver, verifyConnection } from "./services/graph/neo4j.js";
import { startScheduler, stopScheduler } from "./services/scheduler.js";

const logger = pino({ name: "server" });
const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: [
  "http://localhost:5173",
  "https://leads.graphwiz.ai",
  "http://leads.graphwiz.ai",
]}));
app.use(express.json());

app.use("/api", apiRouter);

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Resource not found" } });
    }
  });
});

app.post("/preferences/:contactId/:token", async (req, res) => {
  try {
    const apiRes = await fetch(`http://localhost:${PORT}/api/agents/preferences/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: req.params.contactId, token: req.params.token, ...req.body }),
    });
    const data = await apiRes.json();
    return res.status(apiRes.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: { code: "FORWARD_FAILED", message: err.message } });
  }
});

async function start() {
  const neo4jUri = process.env.NEO4J_URI ?? "bolt://localhost:7687";
  const neo4jUser = process.env.NEO4J_USER ?? "neo4j";
  const neo4jPassword = process.env.NEO4J_PASSWORD ?? "password";

  createDriver({ uri: neo4jUri, user: neo4jUser, password: neo4jPassword });

  const neo4jConnected = await verifyConnection();
  if (neo4jConnected) {
    logger.info("Neo4j connected");
  } else {
    logger.warn("Neo4j not available — start with `docker compose up -d neo4j`");
  }

  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  startScheduler();
}

start().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeDriver();
  await stopScheduler();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await closeDriver();
  await stopScheduler();
  process.exit(0);
});
