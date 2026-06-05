import neo4j, { Driver, Session } from "neo4j-driver";
import pino from "pino";

const logger = pino({ name: "neo4j-service" });

let driver: Driver | null = null;

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export function createDriver(config: Neo4jConfig): Driver {
  if (driver) return driver;

  driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password), {
    maxConnectionLifetime: 3 * 60 * 60 * 1000,
    maxConnectionPoolSize: 10,
  });

  return driver;
}

export async function verifyConnection(): Promise<boolean> {
  if (!driver) return false;
  try {
    await driver.getServerInfo();
    return true;
  } catch (err) {
    logger.error(err, "Neo4j connection failed");
    return false;
  }
}

export async function runQuery(
  cypher: string,
  params: Record<string, unknown> = {}
) {
  if (!driver) throw new Error("Neo4j driver not initialized");

  const session: Session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return {
      records: result.records.map((record) => Object.fromEntries(record.keys.map((k) => [k, record.get(k)]))),
      summary: {
        counters: result.summary.counters.containsUpdates,
      },
    };
  } finally {
    await session.close();
  }
}

/**
 * Run Cypher and return records with native Neo4j type access (numbers, dates, nulls preserved).
 * Use this for queries that read property values where types matter (e.g., scoring).
 */
export async function queryRows(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<any[]> {
  if (!driver) throw new Error("Neo4j driver not initialized");

  const session: Session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => ({
      keys: record.keys,
      ...Object.fromEntries(
        record.keys.map((key) => [key, record.get(key)])
      ),
    }));
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
