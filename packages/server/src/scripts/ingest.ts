import { createDriver, closeDriver } from "../services/graph/neo4j.js";
import { seedGraph, getOrchestrator } from "../services/graph/ingest/index.js";

const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "password";

async function main() {
  const args = process.argv.slice(2);
  const doSeed = args.includes("--seed");
  const doScore = args.includes("--score");
  const sourceFlag = args.find((a) => a.startsWith("--source="));
  const source = sourceFlag ? sourceFlag.split("=")[1] : undefined;

  createDriver({ uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD });

  if (doSeed) {
    console.log("Seeding ontology...");
    const result = await seedGraph();
    console.log("Seed complete:", JSON.stringify(result, null, 2));
  }

  if (doScore) {
    const { scoreAll } = await import("../services/graph/scoring/scorer.js");
    const scored = await scoreAll();
    console.log("=== LeadGraph Scoring Results ===");
    console.log(`Total: ${scored.length} | HOT: ${scored.filter((r) => r.tier === "HOT").length} | WARM: ${scored.filter((r) => r.tier === "WARM").length} | COLD: ${scored.filter((r) => r.tier === "COLD").length}`);
    for (const r of scored.slice(0, 20)) {
      console.log(`[${r.tier}] ${r.companyName} — ${r.totalScore}/100${r.outreachHook ? ` | ${r.outreachHook}` : ""}`);
    }
  }

  if (!doScore && !doSeed) {
    const orchestrator = getOrchestrator();
    const result = source
      ? [await orchestrator.runSingle(source)]
      : await orchestrator.runAll();
    console.log(JSON.stringify(result, null, 2));
  }

  await closeDriver();
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
