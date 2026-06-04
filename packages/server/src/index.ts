import express from "express";
import cors from "cors";
import pino from "pino";
import apiRouter from "./routes/api.js";
import { createDriver, closeDriver, verifyConnection } from "./services/graph/neo4j.js";

const logger = pino({ name: "server" });
const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(cors({ origin: ["http://localhost:5173"] }));
app.use(express.json());

app.use("/api", apiRouter);

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
}

start().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeDriver();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await closeDriver();
  process.exit(0);
});
