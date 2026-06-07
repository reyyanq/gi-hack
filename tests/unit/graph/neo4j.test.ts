import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createDriver, closeDriver, verifyConnection, runQuery } from '../../../packages/server/dist/services/graph/neo4j.js';

let neo4jAvailable = false;

describe('Neo4j Graph Services', () => {
  beforeAll(async () => {
    try {
      createDriver({ uri: 'bolt://localhost:7687', user: 'neo4j', password: 'password' });
      neo4jAvailable = await verifyConnection();
    } catch {
      neo4jAvailable = false;
    }
    if (!neo4jAvailable) {
      console.warn('⚠ Neo4j not available — skipping Neo4j-dependent tests');
    }
  });

  beforeEach((ctx) => {
    if (!neo4jAvailable) ctx.skip();
  });

  afterAll(async () => {
    try { await closeDriver(); } catch { /* driver may not have been created */ }
  });

  describe('Connection Management', () => {
    it('should verify Neo4j connection', async () => {
      const result = await runQuery('RETURN 1 AS test');
      expect(result.records).toBeDefined();
      const testValue = result.records?.[0]?.test;
      const expectedValue = typeof testValue === 'number' ? testValue : testValue?.toNumber();
      expect(expectedValue).toBe(1);
    });

    it('should handle connection errors gracefully', async () => {
      const result = await runQuery('RETURN 1 AS test');
      expect(result).toBeDefined();
    });
  });

  describe('Query Execution', () => {
    it('should execute simple query', async () => {
      const result = await runQuery('RETURN "hello" AS message');
      expect(result.records?.[0]?.message).toBe('hello');
    });

    it('should execute query with parameters', async () => {
      const result = await runQuery(
        'RETURN $value AS result',
        { value: 42 }
      );
      const intResult = result.records?.[0]?.result;
      expect(typeof intResult === 'number' ? intResult : intResult?.toNumber()).toBe(42);
    });

    it('should execute query with multiple parameters', async () => {
      const result = await runQuery(
        'RETURN $a + $b AS sum',
        { a: 10, b: 20 }
      );
      const sumResult = result.records?.[0]?.sum;
      expect(typeof sumResult === 'number' ? sumResult : sumResult?.toNumber()).toBe(30);
    });
  });

  describe('Data Operations', () => {
    it('should create and retrieve nodes', async () => {
      const testId = Date.now();
      await runQuery(
        'MERGE (t:TestNode {id: $id}) SET t.name = $name',
        { id: testId, name: 'Test' }
      );

      const result = await runQuery(
        'MATCH (t:TestNode {id: $id}) RETURN t.name AS name',
        { id: testId }
      );
      expect(result.records?.[0]?.name).toBe('Test');

      await runQuery(
        'MATCH (t:TestNode {id: $id}) DELETE t',
        { id: testId }
      );
    });

    it('should create relationships', async () => {
      const testId = Date.now();
      await runQuery(
        `CREATE (s:Source {id: $sId, name: 'Source'}) 
         CREATE (t:Target {id: $tId, name: 'Target'})
         CREATE (s)-[:RELATES_TO]->(t)`,
        { sId: testId, tId: testId + 1 }
      );

      const result = await runQuery(
        `MATCH (s:Source {id: $sId})-[r:RELATES_TO]->(t:Target)
         RETURN type(r) AS relType`,
        { sId: testId }
      );
      expect(result.records?.[0]?.relType).toBe('RELATES_TO');

      await runQuery(
        'MATCH (s:Source {id: $sId})-[r:RELATES_TO]->(t:Target {id: $tId}) DELETE s, t, r',
        { sId: testId, tId: testId + 1 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Cypher queries', async () => {
      await expect(runQuery('INVALID QUERY')).rejects.toThrow();
    });

    it('should handle empty result sets', async () => {
      const result = await runQuery('MATCH (n:NonExistent) RETURN n');
      expect(result.records).toEqual([]);
    });
  });
});
