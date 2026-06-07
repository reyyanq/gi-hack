/**
 * Cron Jobs Scheduler
 *
 * Handles scheduled tasks for the application.
 *
 * Current Jobs:
 * - Nightly Ingestion: Runs all data sources at 02:00 UTC daily
 */

import cron from "node-cron";
import pino from "pino";
import { runAllIngestion } from "../services/graph/ingest/index.js";

const logger = pino({ name: "scheduler" });

// Schedule: 02:00 UTC every day (Cron: "0 2 * * *")
// Using node-cron format: minute hour day-of-month month day-of-week
const INGESTION_SCHEDULE = "0 2 * * *";

async function runNightlyIngestion() {
  const jobName = "nightly-ingestion";
  logger.info({ job: jobName }, "Starting scheduled ingestion");

  try {
    const result = await runAllIngestion();

    logger.info(
      {
        job: jobName,
        jobId: result.jobId,
        adapters: result.results,
        totalCompanies: result.companiesCreatedOrUpdated,
        duration: result.duration,
      },
      "Scheduled ingestion completed successfully"
    );
  } catch (err: any) {
    logger.error({ job: jobName, error: err }, "Scheduled ingestion failed");
  }
}

export function startScheduler() {
  const task = cron.schedule(INGESTION_SCHEDULE, runNightlyIngestion, {
    timezone: "UTC",
  });

  task.start();

  logger.info(
    {
      schedule: INGESTION_SCHEDULE,
      timezone: "UTC",
      description: "Nightly ingestion of all data sources",
    },
    "Cron scheduler started"
  );
}

export function stopScheduler() {
  const tasks = cron.getTasks();
  tasks.forEach((task) => task.stop());

  logger.info("Cron scheduler stopped");
}

export async function triggerIngestionNow() {
  logger.info("Manually triggering ingestion");
  return runNightlyIngestion();
}
