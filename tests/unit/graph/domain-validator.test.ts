import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dns from 'node:dns';

// Mock dns.resolve before importing module under test
vi.mock('node:dns', () => ({
  resolve: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock pino
vi.mock('pino', () => ({
  default: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Mock neo4j so it's not required for unit testing checkDomain
vi.mock('../../../packages/server/dist/services/graph/neo4j.js', () => ({
  runQuery: vi.fn(),
}));

import { checkDomain, validateAllDomains } from '../../../packages/server/dist/services/graph/domain-validator.js';

describe('Domain Validator', () => {
  describe('checkDomain', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return VALID when DNS resolves and HTTP reachable', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      mockFetch.mockResolvedValue({ status: 200 });

      const result = await checkDomain('siemens-healthineers.com');

      expect(result.status).toBe('VALID');
      expect(result.resolves).toBe(true);
      expect(result.httpReachable).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return INVALID when DNS does not resolve', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) =>
        cb(new Error('ENOTFOUND'), null)
      );

      const result = await checkDomain('definitely-not-a-real-domain-xyz-123.com');

      expect(result.status).toBe('INVALID');
      expect(result.resolves).toBe(false);
      expect(result.httpReachable).toBe(false);
      expect(result.error).toBe('DNS does not resolve');
      // Should not attempt HTTP check
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return UNREACHABLE when DNS resolves but HTTP fails', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      mockFetch.mockImplementation(() => Promise.reject(new Error('ETIMEDOUT')));

      const result = await checkDomain('example-http-timeout.com');

      expect(result.status).toBe('UNREACHABLE');
      expect(result.resolves).toBe(true);
      expect(result.httpReachable).toBe(false);
      expect(result.error).toBe('Domain resolves but HTTP(S) unreachable');
    });

    it('should try HTTP fallback when HTTPS fails', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      mockFetch
        .mockRejectedValueOnce(new Error('HTTPS failed'))
        .mockResolvedValueOnce({ status: 200 });

      const result = await checkDomain('http-only-domain.com');

      expect(result.status).toBe('VALID');
      expect(result.httpReachable).toBe(true);
      // Should have been called twice: HTTPS then HTTP
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle server error status codes (500+) as unreachable', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      mockFetch.mockResolvedValue({ status: 503 });

      const result = await checkDomain('server-error.com');

      expect(result.status).toBe('UNREACHABLE');
    });

    it('should accept any status code below 500 as reachable', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      // Test a few edge status codes
      for (const status of [200, 301, 302, 401, 403, 404, 429]) {
        mockFetch.mockResolvedValue({ status });
        const result = await checkDomain(`status-${status}.com`);
        expect(result.status).toBe('VALID');
      }
    });

    it('should handle domain with uppercase characters', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      mockFetch.mockResolvedValue({ status: 200 });

      // dns.resolve in real life is case-insensitive, but our function passes domain as-is
      const result = await checkDomain('Siemens-Healthineers.COM');
      expect(result.status).toBe('VALID');
    });

    it('should handle subdomains correctly', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      mockFetch.mockResolvedValue({ status: 200 });

      const result = await checkDomain('subdomain.example.com');
      expect(result.status).toBe('VALID');
    });

    it('should handle DNS timeout', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) =>
        cb(new Error('ETIMEOUT'), null)
      );

      const result = await checkDomain('slow-dns.com');
      expect(result.status).toBe('INVALID');
      expect(result.error).toBe('DNS does not resolve');
    });

    it('should handle fetch abort/timeout gracefully', async () => {
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) => cb(null, ['1.2.3.4']));
      mockFetch.mockImplementation(() => {
        const controller = new AbortController();
        controller.abort();
        return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
      });

      const result = await checkDomain('abort-domain.com');
      expect(result.status).toBe('UNREACHABLE');
    });

    it('should handle empty domain string', async () => {
      // dns.resolve with empty string would likely fail
      (dns.resolve as any).mockImplementation((_domain: string, cb: Function) =>
        cb(new Error('ENOTFOUND'), null)
      );

      const result = await checkDomain('');
      expect(result.status).toBe('INVALID');
    });
  });

  describe('validateAllDomains', () => {
    // Mock runQuery for Neo4j calls within validateAllDomains
    // Note: these tests validate the loop logic and result aggregation

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return empty results when no companies have domains', async () => {
      const { runQuery } = await import('../../../packages/server/dist/services/graph/neo4j.js');
      (runQuery as any).mockResolvedValue({ records: [] });

      const result = await validateAllDomains();

      expect(result.total).toBe(0);
      expect(result.valid).toBe(0);
      expect(result.results).toEqual([]);
    });
  });
});
