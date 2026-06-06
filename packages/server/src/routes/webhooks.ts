import { Router, Request, Response } from "express";

const router = Router();

function logWebhook(event: string, body: any) {
  console.log(`[WEBHOOK] ${event}:`, JSON.stringify(body));
}

router.post("/email/opened", (req: Request, res: Response) => {
  logWebhook("email.opened", req.body);
  return res.json({ ok: true });
});

router.post("/email/clicked", (req: Request, res: Response) => {
  logWebhook("email.clicked", req.body);
  return res.json({ ok: true });
});

router.post("/email/bounced", (req: Request, res: Response) => {
  logWebhook("email.bounced", req.body);
  return res.json({ ok: true });
});

export default router;
