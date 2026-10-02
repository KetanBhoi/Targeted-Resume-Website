import { getAuth } from "@clerk/express";
import {
  CreateApplicationShareBody,
  CreateApplicationShareResponse,
  ListApplicationSharesResponse,
  ResolveApplicationShareBody,
  ResolveApplicationShareResponse,
  RevokeApplicationShareByIdParams,
} from "@workspace/api-zod";
import { applicationSharesTable, db, workspaceRecordsTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  createApplicationShareToken,
  hashApplicationShareToken,
  isApplicationShareToken,
  isApplicationShareUnavailable,
} from "../lib/application-share-security";

const router: IRouter = Router();
const resolveLimits = new Map<string, { count: number; resetAt: number }>();
const limitWindow = 60_000;
const limitCount = 30;

function allowResolve(ip: string, now: number): boolean {
  for (const [key, value] of resolveLimits) {
    if (now >= value.resetAt) resolveLimits.delete(key);
  }
  if (resolveLimits.size > 10_000) return false;
  const current = resolveLimits.get(ip);
  if (!current || now >= current.resetAt) {
    resolveLimits.set(ip, { count: 1, resetAt: now + limitWindow });
    return true;
  }
  current.count += 1;
  return current.count <= limitCount;
}

function publicResolverHeaders(res: import("express").Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "no-referrer");
}

router.get("/application-shares", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const rows = await db.select({
    id: applicationSharesTable.id,
    packRecordId: applicationSharesTable.packRecordId,
    title: applicationSharesTable.title,
    createdAt: applicationSharesTable.createdAt,
    expiresAt: applicationSharesTable.expiresAt,
    revokedAt: applicationSharesTable.revokedAt,
  }).from(applicationSharesTable)
    .where(eq(applicationSharesTable.userId, userId))
    .orderBy(desc(applicationSharesTable.createdAt));
  res.json(ListApplicationSharesResponse.parse(rows));
});

router.post("/application-shares", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const parsed = CreateApplicationShareBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.sharingConfirmed) {
    res.status(400).json({ error: "Confirm sharing and provide valid share settings." });
    return;
  }
  const [pack] = await db.select().from(workspaceRecordsTable).where(and(
    eq(workspaceRecordsTable.id, parsed.data.packId),
    eq(workspaceRecordsTable.userId, userId),
    eq(workspaceRecordsTable.kind, "pack"),
  )).limit(1);
  if (!pack || pack.metadata?.reviewed !== true) {
    res.status(404).json({ error: "Application pack not found." });
    return;
  }
  const token = createApplicationShareToken();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000);
  const [share] = await db.insert(applicationSharesTable).values({
    userId,
    packRecordId: pack.id,
    title: pack.title,
    snapshot: JSON.parse(pack.content) as Record<string, unknown>,
    tokenHash: hashApplicationShareToken(token),
    expiresAt,
  }).returning({
    id: applicationSharesTable.id,
    packRecordId: applicationSharesTable.packRecordId,
    title: applicationSharesTable.title,
    createdAt: applicationSharesTable.createdAt,
    expiresAt: applicationSharesTable.expiresAt,
    revokedAt: applicationSharesTable.revokedAt,
  });
  res.status(201).json(CreateApplicationShareResponse.parse({ share, token }));
});

router.post("/application-shares/resolve", async (req, res): Promise<void> => {
  publicResolverHeaders(res);
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!allowResolve(ip, Date.now())) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Resolution limit reached. Try again later." });
    return;
  }
  const parsed = ResolveApplicationShareBody.safeParse(req.body);
  if (!parsed.success || !isApplicationShareToken(parsed.data.token)) {
    res.status(400).json({ error: "Provide a valid share token." });
    return;
  }
  const [share] = await db.select().from(applicationSharesTable)
    .where(eq(applicationSharesTable.tokenHash, hashApplicationShareToken(parsed.data.token)))
    .limit(1);
  if (!share) {
    res.status(404).json({ error: "Share not found." });
    return;
  }
  if (isApplicationShareUnavailable(share.expiresAt, share.revokedAt, Date.now())) {
    res.status(410).json({ error: "This share has expired or was revoked." });
    return;
  }
  res.json(ResolveApplicationShareResponse.parse({
    title: share.title,
    expiresAt: share.expiresAt,
    pack: share.snapshot,
  }));
});

router.delete("/application-shares/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const params = RevokeApplicationShareByIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Share not found." });
    return;
  }
  const [share] = await db.update(applicationSharesTable)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(applicationSharesTable.id, params.data.id),
      eq(applicationSharesTable.userId, userId),
      isNull(applicationSharesTable.revokedAt),
    ))
    .returning({ id: applicationSharesTable.id });
  if (!share) {
    const [existing] = await db.select({ id: applicationSharesTable.id })
      .from(applicationSharesTable)
      .where(and(
        eq(applicationSharesTable.id, params.data.id),
        eq(applicationSharesTable.userId, userId),
      ))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Share not found." });
      return;
    }
  }
  res.sendStatus(204);
});

export default router;