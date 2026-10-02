import {
  GetOwnerPortfolioContentResponse,
  GetPublicPortfolioContentResponse,
  UpdateOwnerPortfolioContentBody,
  UpdateOwnerPortfolioContentResponse,
} from "@workspace/api-zod";
import { db, portfolioContentTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  defaultPortfolioContent,
  publicPortfolioContent,
  validatePortfolioContent,
} from "../lib/portfolio-content";
import { requirePortfolioOwner } from "../lib/require-portfolio-owner";

const router: IRouter = Router();
const singletonId = "main";

router.get("/portfolio/content", async (_req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(portfolioContentTable)
      .where(eq(portfolioContentTable.id, singletonId))
      .limit(1);
    const parsed = validatePortfolioContent(row?.document ?? defaultPortfolioContent);
    if (!parsed.success) {
      res.status(503).json({ error: "Portfolio content is unavailable." });
      return;
    }
    res.json(GetPublicPortfolioContentResponse.parse({
      ...publicPortfolioContent(parsed.data),
      updatedAt: row?.updatedAt ?? null,
    }));
  } catch {
    res.status(503).json({ error: "Portfolio content is unavailable. Try again later." });
  }
});

router.get("/portfolio/content/owner", async (req, res): Promise<void> => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) {
    res.status(403).json({ error: "Only the verified portfolio owner can read portfolio content." });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(portfolioContentTable)
      .where(eq(portfolioContentTable.id, singletonId))
      .limit(1);
    const parsed = validatePortfolioContent(row?.document ?? defaultPortfolioContent);
    if (!parsed.success) {
      res.status(503).json({ error: "Stored portfolio content is invalid and cannot be read." });
      return;
    }
    res.json(GetOwnerPortfolioContentResponse.parse({
      ...parsed.data,
      updatedAt: row?.updatedAt ?? null,
    }));
  } catch {
    res.status(503).json({ error: "Portfolio content is unavailable. Try again later." });
  }
});

router.put("/portfolio/content/owner", async (req, res): Promise<void> => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) {
    res.status(403).json({ error: "Only the verified portfolio owner can update portfolio content." });
    return;
  }

  const contractInput = UpdateOwnerPortfolioContentBody.safeParse(req.body);
  const validated = validatePortfolioContent(req.body);
  if (!contractInput.success || !validated.success) {
    res.status(400).json({
      error: validated.success
        ? "Check all required portfolio fields."
        : validated.error,
    });
    return;
  }

  try {
    const now = new Date();
    const [row] = await db
      .insert(portfolioContentTable)
      .values({
        id: singletonId,
        document: validated.data,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: portfolioContentTable.id,
        set: { document: validated.data, updatedAt: now },
      })
      .returning();

    res.json(UpdateOwnerPortfolioContentResponse.parse({
      ...validated.data,
      updatedAt: row.updatedAt,
    }));
  } catch {
    res.status(503).json({ error: "Portfolio content was not saved. Try again later." });
  }
});

export default router;