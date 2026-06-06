// ============================================================
// Pipeline CRM — Express Routes
// Owner: Beyza (Task 15)
// File: packages/server/src/routes/pipeline.ts
// Mount in index.ts: app.use("/api/pipeline", pipelineRouter)
// ============================================================

import { Router, Request, Response } from "express";
import {
  startPipeline,
  getPipelineLeads,
  advanceStage,
  addNote,
  getActivity,
  getPipelineSummary,
  PipelineStage,
  
} from "../services/graph/pipeline/index.js";

const router = Router();

// ── POST /api/pipeline/start ─────────────────────────────────
// Body: { companyName, contactName, email?, role? }
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { companyName, contactName, email, role } = req.body;
    if (!companyName || !contactName) {
      return res.status(400).json({
        ok: false,
        error: { code: "MISSING_FIELDS", message: "companyName and contactName are required" },
      });
    }
    const lead = await startPipeline({ companyName, contactName, email, role });
    res.status(201).json({ ok: true, data: lead });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_START_FAILED", message } });
  }
});

// ── GET /api/pipeline/leads ───────────────────────────────────
router.get("/leads", async (_req: Request, res: Response) => {
  try {
    const leads = await getPipelineLeads();
    res.json({ ok: true, data: leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_FETCH_FAILED", message } });
  }
});

// ── GET /api/pipeline/summary ─────────────────────────────────
router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await getPipelineSummary();
    res.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_SUMMARY_FAILED", message } });
  }
});

// ── PUT /api/pipeline/:id/advance ────────────────────────────
// Body (optional): { stage: PipelineStage }
router.put("/:id/advance", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const targetStage = req.body?.stage as PipelineStage | undefined;
    const lead = await advanceStage(String(id), targetStage);  // ← String(id)
    res.json({ ok: true, data: lead });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "PIPELINE_ADVANCE_FAILED", message } });
  }
});

// ── POST /api/pipeline/:id/notes ─────────────────────────────
// Body: { note, type? }
router.post("/:id/notes", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note, type } = req.body;
    if (!note) {
      return res.status(400).json({
        ok: false,
        error: { code: "MISSING_FIELDS", message: "note is required" },
      });
    }
    const activity = await addNote({ contactId: String(id), note, type });
    res.status(201).json({ ok: true, data: activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "NOTE_ADD_FAILED", message } });
  }
});

// ── GET /api/pipeline/:id/activity ───────────────────────────
router.get("/:id/activity", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activity = await getActivity(String(id));
    res.json({ ok: true, data: activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: { code: "ACTIVITY_FETCH_FAILED", message } });
  }
});

export default router;
