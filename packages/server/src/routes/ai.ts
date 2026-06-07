import { Router, Request, Response } from 'express';
import type { Driver } from 'neo4j-driver';
import { enrichCompanyData } from '../services/ai/enrich.js';
import { generateOutreachEmail } from '../services/ai/outreach.js';
import { generateScoreExplanation } from '../services/ai/explain.js';

const router = Router();

/** Lazy Neo4j driver — created on first use so bad env vars don't crash the server at import time */
let _driver: Driver | null = null;
async function getDriver(): Promise<Driver> {
  if (!_driver) {
    const neo4j = await import('neo4j-driver');
    _driver = neo4j.default.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.default.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
    );
  }
  return _driver;
}

// POST /api/ai/enrich/:companyId
router.post('/enrich/:companyId', async (req: Request, res: Response): Promise<any> => {
  const session = (await getDriver()).session();
  try {
    const { companyId } = req.params;

    // 1. Fetch raw company info and aggregated signal descriptions from Neo4j graph
    const readQuery = `
      MATCH (c:Company) WHERE id(c) = toInteger($companyId)
      OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
      RETURN c.name AS name, collect(s.description) AS signals
    `;
    const readResult = await session.run(readQuery, { companyId });
    
    if (readResult.records.length === 0) {
      return res.status(404).json({ success: false, error: "Company not found in graph database" });
    }

    const companyName = readResult.records[0].get('name');
    const signalsArray = readResult.records[0].get('signals');
    const signalsText = signalsArray.join(' | ') || "No signals indexed yet.";

    // 2. Trigger LLM to generate enriched industry properties
    const aiResult = await enrichCompanyData(companyName, signalsText);

    // 3. Persist the structural AI metrics back into the Neo4j Company node
    const writeQuery = `
      MATCH (c:Company) WHERE id(c) = toInteger($companyId)
      SET c.segment = $segment,
          c.domain = $domain,
          c.description = $description
      RETURN c
    `;
    await session.run(writeQuery, {
      companyId,
      segment: aiResult.segment,
      domain: aiResult.domain,
      description: aiResult.description
    });

    return res.status(200).json({ success: true, data: aiResult });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

// POST /api/ai/outreach/:companyId
router.post('/outreach/:companyId', async (req: Request, res: Response): Promise<any> => {
  const session = (await getDriver()).session();
  try {
    const { companyId } = req.params;

    // Fetch the required semantic vectors and high-priority relationship tags for context-aware email generation
    const query = `
      MATCH (c:Company) WHERE id(c) = toInteger($companyId)
      OPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)
      OPTIONAL MATCH (c)-[:DEVELOPS]->(a:Application)
      RETURN c.name AS name, c.segment AS segment, c.tier AS tier,
             s.description AS topSignal, a.name AS appName
      ORDER BY s.confidence DESC LIMIT 1
    `;
    const result = await session.run(query, { companyId });

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, error: "Insufficient company data to generate email context" });
    }

    const record = result.records[0];
    
    const inputData = {
      name: record.get('name'),
      segment: record.get('segment') || 'BioTech Firm',
      strongestSignal: record.get('topSignal') || 'Recent market activity',
      matchedLine: (record.get('appName') === 'Hemostasis' ? 'Hemostasis' : 'Plasma Proteins') as any,
      tier: (record.get('tier') || 'WARM') as any,
      matchedItemsCount: 6 // Mocking portfolio cross-match count, can be bound to count(relationships) if needed
    };

    const emailDraft = await generateOutreachEmail(inputData);
    return res.status(200).json({ success: true, emailDraft });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

// GET /api/ai/explain/:companyId
router.get('/explain/:companyId', async (req: Request, res: Response): Promise<any> => {
  const session = (await getDriver()).session();
  try {
    const { companyId } = req.params;

    // Fetch algorithmic execution breakdown metrics computed earlier by Tobias' scoring script
    const query = `
      MATCH (c:Company) WHERE id(c) = toInteger($companyId)
      RETURN c.name AS name, c.totalScore AS totalScore, c.signalScore AS signalScore, c.productFit AS productFit
    `;
    const result = await session.run(query, { companyId });

    if (result.records.length === 0) {
      return res.status(404).json({ success: false, error: "Company data or score nodes are missing from the graph" });
    }

    const record = result.records[0];
    const breakdown = {
      total: record.get('totalScore'),
      signal: record.get('signalScore'),
      fit: record.get('productFit')
    };

    const explanation = await generateScoreExplanation(record.get('name'), breakdown);
    return res.status(200).json({ success: true, explanation });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

export default router;
