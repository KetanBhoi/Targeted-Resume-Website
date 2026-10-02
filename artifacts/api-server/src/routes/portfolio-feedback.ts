import { SubmitPortfolioFeedbackBody, DeletePortfolioFeedbackParams } from "@workspace/api-zod";
import { db, portfolioFeedbackTable } from "@workspace/db";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requirePortfolioOwner } from "../lib/require-portfolio-owner";

const router: IRouter = Router();
const limits = new Map<string, { count: number; until: number }>();
const hour = 3_600_000;

router.get("/portfolio/owner-access", async (req, res) => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner !== null) res.json({ isOwner });
});

router.get("/portfolio/feedback", async (req, res) => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) { res.status(403).json({ error: "Only the verified portfolio owner can read feedback." }); return; }
  try {
    const rows = await db.select().from(portfolioFeedbackTable).orderBy(desc(portfolioFeedbackTable.createdAt), desc(portfolioFeedbackTable.id)).limit(100);
    res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
  } catch {
    res.status(503).json({ error: "Feedback unavailable. Try again later." });
  }
});

router.post("/portfolio/feedback", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = SubmitPortfolioFeedbackBody.safeParse(req.body);
  if (!parsed.success || parsed.data.message.trim().length < 10 || parsed.data.website) {
    res.status(400).json({ error: "Please write a note between 10 and 1,200 characters." }); return;
  }
  const now = Date.now();
  for (const [key, entry] of limits) if (entry.until <= now) limits.delete(key);
  // Per connection limiter complements the durable global cap below. No IPs are stored in the DB.
  const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const entry = limits.get(key) ?? { count: 0, until: now + hour };
  if (entry.count >= 10 || limits.size > 10_000) {
    res.setHeader("Retry-After", "3600");
    res.status(429).json({ error: "Submission limit reached. Please try again later." }); return;
  }
  entry.count += 1;
  limits.set(key, entry);
  try {
    const accepted = await db.transaction(async (tx) => {
      // Serialize submissions across server replicas, not just one in-memory process.
      await tx.execute(sql`select pg_advisory_xact_lock(6021002)`);
      const [recent] = await tx.select({ value: count() }).from(portfolioFeedbackTable)
        .where(gte(portfolioFeedbackTable.createdAt, new Date(now - hour)));
      if (recent.value >= 60) return false;
      await tx.insert(portfolioFeedbackTable).values({
        roleView: parsed.data.roleView, signal: parsed.data.signal, message: parsed.data.message.trim(),
      });
      return true;
    });
    if (!accepted) {
      res.setHeader("Retry-After", "3600");
      res.status(429).json({ error: "Feedback is busy. Please try again later." }); return;
    }
    res.status(201).json({ received: true });
  } catch {
    res.status(503).json({ error: "Your note was not saved. Please try again later." });
  }
});

router.delete("/portfolio/feedback/:id", async (req, res) => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) { res.status(403).json({ error: "Only the verified portfolio owner can delete feedback." }); return; }
  const parsed = DeletePortfolioFeedbackParams.safeParse(req.params);
  if (!parsed.success) { res.status(404).json({ error: "Note not found." }); return; }
  try {
    const deleted = await db.delete(portfolioFeedbackTable).where(eq(portfolioFeedbackTable.id, parsed.data.id)).returning({ id: portfolioFeedbackTable.id });
    if (!deleted.length) { res.status(404).json({ error: "Note not found." }); return; }
    res.status(204).send();
  } catch {
    res.status(503).json({ error: "The note could not be deleted." });
  }
});

export default router;