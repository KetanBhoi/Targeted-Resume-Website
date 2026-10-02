import { getAuth } from "@clerk/express";
import {
  CreateCaseStudyBody,
  CreateCaseStudyResponse,
  DeleteCaseStudyParams,
  ListOwnerCaseStudiesResponse,
  ListPublicCaseStudiesResponse,
  UpdateCaseStudyBody,
  UpdateCaseStudyParams,
  UpdateCaseStudyResponse,
} from "@workspace/api-zod";
import { db, portfolioCaseStudiesTable, workspaceRecordsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { publicCaseStudy, validCaseStudyPublication } from "../lib/case-study-policy";
import { requirePortfolioOwner } from "../lib/require-portfolio-owner";

const router: IRouter = Router();

function privateEntity(row: typeof portfolioCaseStudiesTable.$inferSelect) {
  return {
    id: row.id,
    simulationId: row.sourceSimulationId,
    title: row.title,
    summary: row.summary,
    jobDescription: row.jobDescription,
    outreach: row.outreach,
    reasoning: row.reasoning,
    lessons: row.lessons,
    fictionalConfirmed: row.fictionalConfirmed,
    published: row.published,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/portfolio/case-studies", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const rows = await db.select().from(portfolioCaseStudiesTable)
    .where(and(
      eq(portfolioCaseStudiesTable.published, true),
      eq(portfolioCaseStudiesTable.fictionalConfirmed, true),
    ))
    .orderBy(desc(portfolioCaseStudiesTable.createdAt));
  res.json(ListPublicCaseStudiesResponse.parse(rows.map(publicCaseStudy)));
});

router.get("/portfolio/case-studies/owner", async (req, res): Promise<void> => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) {
    res.status(403).json({ error: "Only the verified portfolio owner can manage case studies." });
    return;
  }
  const userId = getAuth(req).userId!;
  const rows = await db.select().from(portfolioCaseStudiesTable)
    .where(eq(portfolioCaseStudiesTable.userId, userId))
    .orderBy(desc(portfolioCaseStudiesTable.updatedAt));
  res.json(ListOwnerCaseStudiesResponse.parse(rows.map(privateEntity)));
});

router.post("/portfolio/case-studies/owner", async (req, res): Promise<void> => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) {
    res.status(403).json({ error: "Only the verified portfolio owner can create case studies." });
    return;
  }
  const parsed = CreateCaseStudyBody.safeParse(req.body);
  if (!parsed.success || !validCaseStudyPublication(parsed.data)) {
    res.status(400).json({ error: "Review the exact public text and confirm fictional practice before publishing." });
    return;
  }
  const userId = getAuth(req).userId!;
  const [source] = await db.select({ id: workspaceRecordsTable.id }).from(workspaceRecordsTable)
    .where(and(
      eq(workspaceRecordsTable.id, parsed.data.simulationId),
      eq(workspaceRecordsTable.userId, userId),
      eq(workspaceRecordsTable.kind, "simulation"),
    ))
    .limit(1);
  if (!source) {
    res.status(404).json({ error: "Owned source simulation not found." });
    return;
  }
  const [row] = await db.insert(portfolioCaseStudiesTable).values({
    userId,
    sourceSimulationId: source.id,
    title: parsed.data.title,
    summary: parsed.data.summary,
    jobDescription: parsed.data.jobDescription,
    outreach: parsed.data.outreach,
    reasoning: parsed.data.reasoning,
    lessons: parsed.data.lessons,
    fictionalConfirmed: parsed.data.fictionalConfirmed,
    published: parsed.data.published,
  }).returning();
  res.status(201).json(CreateCaseStudyResponse.parse(privateEntity(row)));
});

router.patch("/portfolio/case-studies/owner/:id", async (req, res): Promise<void> => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) {
    res.status(403).json({ error: "Only the verified portfolio owner can update case studies." });
    return;
  }
  const params = UpdateCaseStudyParams.safeParse(req.params);
  const parsed = UpdateCaseStudyBody.safeParse(req.body);
  if (!params.success || !parsed.success || !validCaseStudyPublication(parsed.data)) {
    res.status(400).json({ error: "Review the exact public text and confirm fictional practice before publishing." });
    return;
  }
  const userId = getAuth(req).userId!;
  const [row] = await db.update(portfolioCaseStudiesTable).set({
    title: parsed.data.title,
    summary: parsed.data.summary,
    jobDescription: parsed.data.jobDescription,
    outreach: parsed.data.outreach,
    reasoning: parsed.data.reasoning,
    lessons: parsed.data.lessons,
    fictionalConfirmed: parsed.data.fictionalConfirmed,
    published: parsed.data.published,
    updatedAt: new Date(),
  }).where(and(
    eq(portfolioCaseStudiesTable.id, params.data.id),
    eq(portfolioCaseStudiesTable.userId, userId),
  )).returning();
  if (!row) {
    res.status(404).json({ error: "Case study not found." });
    return;
  }
  res.json(UpdateCaseStudyResponse.parse(privateEntity(row)));
});

router.delete("/portfolio/case-studies/owner/:id", async (req, res): Promise<void> => {
  const isOwner = await requirePortfolioOwner(req, res);
  if (isOwner === null) return;
  if (!isOwner) {
    res.status(403).json({ error: "Only the verified portfolio owner can delete case studies." });
    return;
  }
  const params = DeleteCaseStudyParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Case study not found." });
    return;
  }
  const userId = getAuth(req).userId!;
  const [deleted] = await db.delete(portfolioCaseStudiesTable).where(and(
    eq(portfolioCaseStudiesTable.id, params.data.id),
    eq(portfolioCaseStudiesTable.userId, userId),
  )).returning({ id: portfolioCaseStudiesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Case study not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;