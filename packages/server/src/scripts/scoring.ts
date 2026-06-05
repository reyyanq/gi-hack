import { createDriver, closeDriver } from "../services/graph/neo4j.js";
import { scoreAll } from "../services/graph/scoring/scorer.js";

const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "password";

async function main() {
  createDriver({ uri: NEO4J_URI, user: NEO4J_USER, password: NEO4J_PASSWORD });
  const results = await scoreAll();
  console.log("=== LeadGraph Scoring Results ===");
  console.log(`Total companies scored: ${results.length}`);
  console.log(`HOT:  ${results.filter((r) => r.tier === "HOT").length}`);
  console.log(`WARM: ${results.filter((r) => r.tier === "WARM").length}`);
  console.log(`COLD: ${results.filter((r) => r.tier === "COLD").length}`);
  console.log("");
  for (const r of results) {
    const flag = r.tier === "HOT" ? "🔥" : r.tier === "WARM" ? "⭐" : "  ";
    console.log(`${flag} [${r.tier}] ${r.companyName} — Score: ${r.totalScore}/100`);
    console.log(`   Signals: ${r.breakdown.signalScore} | Fit: ${r.breakdown.productFitScore} | Seg: ${r.breakdown.segmentBonus} | Rec: ${r.breakdown.recencyBonus}`);
    if (r.outreachHook) console.log(`   Hook: ${r.outreachHook}`);
    if (r.disqualifiers.length) console.log(`   ⚠ ${r.disqualifiers.join("; ")}`);
    console.log("");
  }
  await closeDriver();
}

main().catch((err) => {
  console.error("Scoring failed:", err);
  process.exit(1);
});
