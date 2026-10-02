import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { hasVerifiedOwnerEmail } from "./portfolio-owner";

/**
 * Verifies ownership using Clerk's server-side user record and verified email.
 * A null result means the helper has already sent a fail-closed error response.
 */
export async function requirePortfolioOwner(
  req: Request,
  res: Response,
): Promise<boolean | null> {
  res.setHeader("Cache-Control", "no-store");
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in required." });
    return null;
  }
  if (!process.env.PORTFOLIO_OWNER_EMAIL?.trim()) {
    res.status(503).json({ error: "Owner access is not configured." });
    return null;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    return hasVerifiedOwnerEmail(user.emailAddresses, process.env.PORTFOLIO_OWNER_EMAIL);
  } catch {
    res.status(503).json({ error: "Unable to verify owner access. Try again later." });
    return null;
  }
}