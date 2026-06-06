import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { startPipeline, advanceStage, regressStage, addActivity, getPipelineLeads, ensurePipelineStages } from '../../../packages/server/dist/services/graph/pipeline/index.js';
import { runQuery, createDriver, closeDriver, verifyConnection } from '../../../packages/server/dist/services/graph/neo4j.js';

describe('Pipeline CRM Logic', () => {
  beforeAll(async () => {
    createDriver({ uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' });
    const connected = await verifyConnection();
    expect(connected).toBe(true);
    await ensurePipelineStages();
  });

  afterAll(async () => {
    await closeDriver();
  });

  beforeEach(async () => {
    await ensurePipelineStages();
  });

  afterEach(async () => {
    await runQuery('MATCH (c:Contact) WHERE c.name STARTS WITH "TestContact" DETACH DELETE c');
  });

  describe('Pipeline Stage Management', () => {
    it('should ensure all pipeline stages exist', async () => {
      const result = await runQuery('MATCH (s:PipelineStage) RETURN s.name AS stage ORDER BY s.name');
      const stages = result.records?.map(r => r.stage) || [];
      const expectedStages = ['Closed Lost', 'Closed Won', 'Meeting', 'New', 'Proposal', 'Contacted'];
      expect(stages.length).toBe(expectedStages.length);
      expectedStages.forEach(stage => expect(stages).toContain(stage));
    });
  });

  describe('Pipeline Lead Creation', () => {
    it('should create new pipeline lead with contact', async () => {
      const testId = Date.now();
      await runQuery(
        `MERGE (c:Company {name: $name}) 
         SET c.domain = $domain, c.segment = 'IVD', c.tier = 'WARM'`,
        { name: `Test Company ${testId}`, domain: `test${testId}.com` }
      );

      const result = await startPipeline(
        `Test Company ${testId}`,
        'TestContact',
        `test${testId}@example.com`,
        'CTO'
      );

      expect(result.contactId).toBeDefined();
      expect(typeof result.contactId).toBe('string');

      const leadCheck = await runQuery(
        'MATCH (c:Contact {id: $id}) RETURN c.name AS name, c.email AS email',
        { id: result.contactId }
      );
      expect(leadCheck.records?.[0]?.name).toBe('TestContact');
      expect(leadCheck.records?.[0]?.email).toBe(`test${testId}@example.com`);
    });

    it('should start lead in New stage', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const result = await startPipeline(`Test Company ${testId}`, 'TestContact');

      const stageCheck = await runQuery(
        `MATCH (c:Contact {id: $id})-[r:IN_STAGE]->(s:PipelineStage)
         RETURN s.name AS stage`,
        { id: result.contactId }
      );
      expect(stageCheck.records?.[0]?.stage).toBe('New');
    });

    it('should handle missing company gracefully', async () => {
      await expect(
        startPipeline('NonExistentCompanyXYZ', 'TestContact', 'test@example.com', 'CTO')
      ).rejects.toThrow();
    });
  });

  describe('Stage Transitions', () => {
    it('should advance lead to next stage', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');

      const { newStage } = await advanceStage(contactId);
      expect(newStage).toBe('Contacted');
    });

    it('should advance lead multiple stages', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');

      await advanceStage(contactId);
      expect((await advanceStage(contactId)).newStage).toBe('Meeting');
    });

    it('should not advance beyond final stage', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');

      await advanceStage(contactId);
      await advanceStage(contactId);
      await advanceStage(contactId);
      await advanceStage(contactId);

      await expect(advanceStage(contactId)).rejects.toThrow();
    });

    it('should regress lead to specific stage', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');
      await advanceStage(contactId);

      const { newStage } = await regressStage(contactId, 'New');
      expect(newStage).toBe('New');
    });

    it('should handle invalid stage names', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');

      await expect(regressStage(contactId, 'InvalidStage')).rejects.toThrow();
    });
  });

  describe('Activity Management', () => {
    it('should add activity to contact', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');

      const result = await addActivity(contactId, 'EMAIL', 'Test activity note');
      expect(result.activityId).toBeDefined();

      const activityCheck = await runQuery(
        `MATCH (c:Contact {id: $id})-[:HAS_ACTIVITY]->(a:Activity)
         RETURN a.type AS type, a.note AS note`,
        { id: contactId }
      );
      expect(activityCheck.records?.[0]?.type).toBe('EMAIL');
      expect(activityCheck.records?.[0]?.note).toBe('Test activity note');
    });

    it('should support different activity types', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');

      await addActivity(contactId, 'NOTE', '电话沟通');
      await addActivity(contactId, 'CALL', '周会讨论');

      const activities = await runQuery(
        `MATCH (c:Contact {id: $id})-[:HAS_ACTIVITY]->(a:Activity)
         RETURN a.type AS type ORDER BY a.date DESC`,
        { id: contactId }
      );

      expect(activities.records?.length).toBe(2);
      const types = activities.records?.map(r => r.type);
      expect(types).toContain('NOTE');
      expect(types).toContain('CALL');
    });
  });

  describe('Pipeline Retrieval', () => {
    it('should retrieve all pipeline leads', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}A`, domain: `testa${testId}.com` });
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}B`, domain: `testb${testId}.com` });
      await startPipeline(`Test Company ${testId}A`, 'TestContactA', `testa${testId}@example.com`);
      await startPipeline(`Test Company ${testId}B`, 'TestContactB', `testb${testId}@example.com`);

      const leads = await getPipelineLeads();
      expect(leads.length).toBeGreaterThan(0);
    });

    it('should include contact information', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact', `test${testId}@example.com`, 'VP Sales');

      const leads = await getPipelineLeads();
      const testLead = leads.find(l => l.companyName.includes(`Test Company ${testId}`));

      expect(testLead).toBeDefined();
      expect(testLead?.contacts.length).toBeGreaterThan(0);
      expect(testLead?.contacts[0].email).toBe(`test${testId}@example.com`);
      expect(testLead?.contacts[0].role).toBe('VP Sales');
    });

    it('should include current stage', async () => {
      const testId = Date.now();
      await runQuery(`MERGE (c:Company {name: $name}) SET c.domain = $domain`, { name: `Test Company ${testId}`, domain: `test${testId}.com` });
      const { contactId } = await startPipeline(`Test Company ${testId}`, 'TestContact');

      const leads = await getPipelineLeads();
      const testLead = leads.find(l => l.companyName.includes(`Test Company ${testId}`));

      expect(testLead?.currentStage).toBe('New');
    });
  });
});
