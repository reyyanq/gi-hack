import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRouter from '../../../packages/server/dist/routes/api.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('API Integration Tests', () => {
  describe('Health Endpoints', () => {
    it('GET /api/health should return server health', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('uptime');
    });
  });

  describe('Graph Endpoints', () => {
    it('GET /api/graph/health should check Neo4j connection', async () => {
      const response = await request(app)
        .get('/api/graph/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('connected');
    });

    it('GET /api/graph/stats should return node/relationship counts', async () => {
      const response = await request(app)
        .get('/api/graph/stats')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('nodes');
      expect(response.body.data).toHaveProperty('relationships');
    });

    it('GET /api/graph/score should compute lead scoring', async () => {
      const response = await request(app)
        .get('/api/graph/score')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('scored');
    });
  });

  describe('Pipeline Endpoints', () => {
    it('GET /api/pipeline/stages should return pipeline stages', async () => {
      const response = await request(app)
        .get('/api/pipeline/stages')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/pipeline/leads should return pipeline leads', async () => {
      const response = await request(app)
        .get('/api/pipeline/leads')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('POST /api/pipeline/start should create new pipeline lead', async () => {
      const newLead = {
        companyName: 'Test Company ' + Date.now(),
        contactName: 'Test Contact',
        contactEmail: 'test@example.com',
        contactRole: 'CTO'
      };

      const response = await request(app)
        .post('/api/pipeline/start')
        .send(newLead)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('contactId');
    });
  });

  describe('AI Endpoints', () => {
    it('POST /api/ai/enrich/:companyId should enrich company data', async () => {
      const response = await request(app)
        .post('/api/ai/enrich/test-company-id')
        .send({})
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('ok');
    });

    it('POST /api/ai/outreach/:companyId should generate outreach email', async () => {
      const response = await request(app)
        .post('/api/ai/outreach/test-company-id')
        .send({})
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('ok');
    });
  });
});
