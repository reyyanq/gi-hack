import { Router, Request, Response } from "express";
import {
  ensurePipelineStages,
  getPipelineLeads,
  startPipeline,
  advanceStage,
  regressStage,
  addActivity,
  getContactActivity,
  STAGES,
} from "../services/graph/pipeline/index.js";

const router = Router();

let stagesEnsured = false;
async function ensureStages() {
  if (!stagesEnsured) {
    await ensurePipelineStages();
    stagesEnsured = true;
  }
}

router.get("/stages", (_req: Request, res: Response) => {
  res.json({ ok: true, data: { stages: STAGES } });
});

router.get("/leads", async (_req: Request, res: Response) => {
  try {
    await ensureStages();
    const leads = await getPipelineLeads();
    res.json({ ok: true, data: { leads } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_LEADS_FAILED", message } });
  }
});

router.post("/start", async (req: Request, res: Response) => {
  try {
    await ensureStages();
    const { companyName, contactName, contactEmail, contactRole } = req.body;

    if (!companyName || typeof companyName !== "string") {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_INPUT", message: "companyName (string) is required" },
      });
      return;
    }

    const result = await startPipeline(companyName, contactName, contactEmail, contactRole);
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_START_FAILED", message } });
  }
});

router.put("/:contactId/advance", async (req: Request, res: Response) => {
  try {
    const contactId = req.params.contactId as string;
    const result = await advanceStage(contactId);
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_ADVANCE_FAILED", message } });
  }
});

router.put("/:contactId/regress", async (req: Request, res: Response) => {
  try {
    const contactId = req.params.contactId as string;
    const { stage } = req.body;

    if (!stage || typeof stage !== "string") {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_INPUT", message: "stage (string) is required" },
      });
      return;
    }

    const result = await regressStage(contactId, stage);
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_REGRESS_FAILED", message } });
  }
});

router.post("/:contactId/activity", async (req: Request, res: Response) => {
  try {
    const contactId = req.params.contactId as string;
    const { type, note } = req.body;

    if (!type || !note || typeof type !== "string" || typeof note !== "string") {
      res.status(400).json({
        ok: false,
        error: { code: "INVALID_INPUT", message: "type and note (strings) are required" },
      });
      return;
    }

    const result = await addActivity(contactId, type, note);
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_ACTIVITY_FAILED", message } });
  }
});

router.get("/:contactId/activity", async (req: Request, res: Response) => {
  try {
    const contactId = req.params.contactId as string;
    const activities = await getContactActivity(contactId);
    res.json({ ok: true, data: { activities } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_ACTIVITY_FAILED", message } });
  }
});

export default router;
