import * as dns from "node:dns";
import { runQuery } from "./neo4j.js";
import pino from "pino";

const logger = pino({ name: "domain-validator" });

export interface DomainCheckResult {
  domain: string;
  companyName: string;
  resolves: boolean;
  httpReachable: boolean;
  status: "VALID" | "INVALID" | "UNREACHABLE";
  error?: string;
}

function dnsResolves(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    dns.resolve(domain, (err) => resolve(!err));
  });
}

async function httpReachable(domain: string, timeoutMs = 5000): Promise<boolean> {
  for (const proto of ["https", "http"]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${proto}://${domain}`, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "LeadGraph/1.0" },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (res.status < 500) return true;
    } catch {
      clearTimeout(timer);
    }
  }
  return false;
}

export async function checkDomain(domain: string): Promise<DomainCheckResult> {
  const dnsOk = await dnsResolves(domain);
  if (!dnsOk) {
    return {
      domain,
      companyName: "",
      resolves: false,
      httpReachable: false,
      status: "INVALID",
      error: "DNS does not resolve",
    };
  }

  const httpOk = await httpReachable(domain);
  if (!httpOk) {
    return {
      domain,
      companyName: "",
      resolves: true,
      httpReachable: false,
      status: "UNREACHABLE",
      error: "Domain resolves but HTTP(S) unreachable",
    };
  }

  return {
    domain,
    companyName: "",
    resolves: true,
    httpReachable: true,
    status: "VALID",
  };
}

export async function validateAllDomains(): Promise<{
  total: number;
  valid: number;
  invalid: number;
  unreachable: number;
  cleared: number;
  results: DomainCheckResult[];
}> {
  const result = await runQuery(
    `MATCH (c:Company)
     WHERE c.domain IS NOT NULL AND c.domain <> ""
     RETURN c.name AS name, c.domain AS domain
     ORDER BY c.name`
  );

  const rows = result.records ?? [];
  let valid = 0;
  let invalid = 0;
  let unreachable = 0;
  let cleared = 0;
  const results: DomainCheckResult[] = [];

  const batchSize = 10;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const checks = await Promise.all(
      batch.map(async (row: any) => {
        const name = row.name as string;
        const domain = (row.domain as string).toLowerCase().trim();
        const check = await checkDomain(domain);
        check.companyName = name;
        return check;
      })
    );

    for (const check of checks) {
      results.push(check);
      if (check.status === "VALID") valid++;
      else if (check.status === "INVALID") {
        invalid++;
        await runQuery(
          `MATCH (c:Company {name: $name})
           SET c.domain = null`,
          { name: check.companyName }
        );
        cleared++;
        logger.warn({ company: check.companyName, domain: check.domain }, "Cleared invalid domain");
      } else {
        unreachable++;
      }
    }

    if (i + batchSize < rows.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return { total: rows.length, valid, invalid, unreachable, cleared, results };
}
