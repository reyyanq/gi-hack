import { generateText } from "ai";
import { createAIProvider } from "../ai/llm.js";
import { checkDomain } from "./domain-validator.js";
import { queryRows, runQuery } from "./neo4j.js";
import neo4j from "neo4j-driver";
import pino from "pino";

const logger = pino({ name: "domain-finder" });

const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
const LLM_BASE_URL = process.env.LLM_BASE_URL;
const LLM_MODEL = process.env.LLM_MODEL || "deepseek-v4-flash";

export interface DomainSuggestion {
  companyName: string;
  suggestedDomain: string | null;
  validated: boolean;
  status: "FOUND_VALID" | "FOUND_INVALID" | "NOT_FOUND" | "ERROR";
  error?: string;
}

async function suggestDomain(companyName: string): Promise<string | null> {
  const { openai, model } = createAIProvider({
    apiKey: LLM_API_KEY,
    baseURL: LLM_BASE_URL,
    model: LLM_MODEL,
  });

  const systemPrompt = [
    "You are a B2B sales intelligence assistant.",
    "Given a company name, return ONLY the company's official website domain.",
    'Example: "Siemens Healthineers" → "siemens-healthineers.com"',
    'Do NOT include "www." or "https://".',
    "If you don't know the domain, return exactly: UNKNOWN",
    "Return ONLY the domain or UNKNOWN. No other text, no markdown.",
  ].join("\n");

  const { text } = await generateText({
    model: openai(model),
    system: systemPrompt,
    prompt: `What is the official website domain for "${companyName}"?`,
    temperature: 0.1,
  });

  const result = text.trim().toLowerCase();
  if (result === "unknown" || !result.includes(".")) return null;

  // Strip markdown code block markers if present
  const cleaned = result.replace(/^```[\s\S]*?\n/, "").replace(/\n```$/, "").trim();
  if (!cleaned.includes(".")) return null;

  return cleaned
    .replace(/^(https?:\/\/)?(www\d?\.)?/, "")
    .replace(/\/.*$/, "")
    .trim();
}

/**
 * Enrich a single company's domain: LLM suggest + DNS validate + persist to Neo4j.
 * Returns the validated domain or null if not found.
 */
export async function enrichSingleDomain(companyName: string): Promise<string | null> {
  try {
    const suggested = await suggestDomain(companyName);
    if (!suggested) {
      logger.warn({ company: companyName }, "No domain suggested by LLM");
      return null;
    }

    const validation = await checkDomain(suggested);
    if (validation.status !== "VALID") {
      logger.warn({ company: companyName, domain: suggested, reason: validation.error }, "Domain validation failed");
      return null;
    }

    await runQuery(
      `MATCH (c:Company {name: $name}) SET c.domain = $domain`,
      { name: companyName, domain: suggested }
    );
    logger.info({ company: companyName, domain: suggested }, "Domain enriched for single company");
    return suggested;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ company: companyName, error: msg }, "Single domain enrichment error");
    return null;
  }
}

export async function enrichDomains(options?: {
  limit?: number;
  concurrency?: number;
}): Promise<{
  total: number;
  found: number;
  validated: number;
  notFound: number;
  errors: number;
  results: DomainSuggestion[];
}> {
  const concurrency = options?.concurrency ?? 5;
  const limit = options?.limit ?? 200;

  const companies = await queryRows(
    `MATCH (c:Company)
     WHERE c.domain IS NULL
     RETURN c.name AS name
     ORDER BY c.name
     ${limit > 0 ? "LIMIT $limit" : ""}`,
    limit > 0 ? { limit: neo4j.int(limit) } : {}
  );

  const names = companies.map((r: any) => r.name as string);
  logger.info({ total: names.length }, "Starting domain enrichment");

  const results: DomainSuggestion[] = [];

  for (let i = 0; i < names.length; i += concurrency) {
    const batch = names.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (name) => {
        try {
          const suggested = await suggestDomain(name);
          if (!suggested) {
            return {
              companyName: name,
              suggestedDomain: null,
              validated: false,
              status: "NOT_FOUND" as const,
            };
          }

          const validation = await checkDomain(suggested);
          if (validation.status === "VALID") {
            await runQuery(
              `MATCH (c:Company {name: $name}) SET c.domain = $domain`,
              { name, domain: suggested }
            );
            logger.info(
              { company: name, domain: suggested },
              "Found and validated domain"
            );
            return {
              companyName: name,
              suggestedDomain: suggested,
              validated: true,
              status: "FOUND_VALID" as const,
            };
          }

          logger.warn(
            { company: name, domain: suggested, reason: validation.error },
            "Domain suggested but DNS/HTTP validation failed"
          );
          return {
            companyName: name,
            suggestedDomain: suggested,
            validated: false,
            status: "FOUND_INVALID" as const,
            error: validation.error,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error({ company: name, error: msg }, "Domain enrichment error");
          return {
            companyName: name,
            suggestedDomain: null,
            validated: false,
            status: "ERROR" as const,
            error: msg,
          };
        }
      })
    );

    results.push(...batchResults);

    if (i + concurrency < names.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return {
    total: names.length,
    found: results.filter((r) => r.status === "FOUND_VALID").length,
    validated: results.filter((r) => r.validated).length,
    notFound: results.filter((r) => r.status === "NOT_FOUND").length,
    errors: results.filter((r) => r.status === "ERROR").length,
    results,
  };
}
