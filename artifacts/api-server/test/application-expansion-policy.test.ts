import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CreateApplicationPackBody } from "@workspace/api-zod";
import {
  createApplicationShareToken,
  hashApplicationShareToken,
  isApplicationShareToken,
  isApplicationShareUnavailable,
} from "../src/lib/application-share-security";
import { isPackSourceFactReviewed } from "../src/lib/application-pack-policy";
import { publicCaseStudy, validCaseStudyPublication } from "../src/lib/case-study-policy";

describe("application share and pack policies", () => {
  it("rejects an empty or whitespace-only recruiter brief", () => {
    const validInput = {
      title: "Application",
      resumeId: 1,
      coverLetterId: null,
      brief: " ",
      links: [],
      reviewConfirmed: true,
    };
    expect(CreateApplicationPackBody.safeParse(validInput).success).toBe(false);
    expect(CreateApplicationPackBody.safeParse({ ...validInput, brief: "A reviewed brief." }).success).toBe(true);
  });

  it("creates a one-time high entropy token but persists a distinct SHA-256 digest", () => {
    const secret = createApplicationShareToken();
    const hash = hashApplicationShareToken(secret);
    expect(isApplicationShareToken(secret)).toBe(true);
    expect(hash).toBe(createHash("sha256").update(secret).digest("hex"));
    expect(hash).not.toContain(secret);
    expect(isApplicationShareToken("A".repeat(43))).toBe(false);
    expect(isApplicationShareToken("short")).toBe(false);
  });

  it("expires and revokes shares without altering their snapshots", () => {
    const now = Date.now();
    expect(isApplicationShareUnavailable(new Date(now + 1000), null, now)).toBe(false);
    expect(isApplicationShareUnavailable(new Date(now - 1), null, now)).toBe(true);
    expect(isApplicationShareUnavailable(new Date(now + 1000), new Date(now), now)).toBe(true);
    expect(isPackSourceFactReviewed({ verificationStatus: "needs-review" })).toBe(false);
    expect(isPackSourceFactReviewed({ verificationStatus: "verified" })).toBe(true);
    expect(isPackSourceFactReviewed(null)).toBe(true);
  });
});

describe("case study publication policy and public allowlist", () => {
  it("requires explicit fictional confirmation and meaningful reviewed copy to publish", () => {
    const complete = {
      title: "Practice scenario",
      summary: "A reviewed summary.",
      reasoning: "My reasoning.",
      lessons: "Lessons learned.",
      fictionalConfirmed: true,
      published: true,
    };
    expect(validCaseStudyPublication(complete)).toBe(true);
    expect(validCaseStudyPublication({ ...complete, fictionalConfirmed: false })).toBe(false);
    expect(validCaseStudyPublication({ ...complete, summary: "  " })).toBe(false);
    expect(validCaseStudyPublication({ ...complete, published: false, fictionalConfirmed: false })).toBe(true);
  });

  it("exposes only approved public copy, dates, id, and fixed fictional-practice labeling", () => {
    const result = publicCaseStudy({
      id: "b2c95f0a-2b47-42e4-9d3a-33950b11747e",
      userId: "private-owner",
      sourceSimulationId: 99,
      title: "Practice",
      summary: "Summary",
      jobDescription: "",
      outreach: "",
      reasoning: "Reasoning",
      lessons: "Lessons",
      fictionalConfirmed: true,
      published: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as Parameters<typeof publicCaseStudy>[0]);
    expect(Object.keys(result).sort()).toEqual([
      "createdAt", "id", "jobDescription", "label", "lessons", "outreach",
      "reasoning", "summary", "title", "updatedAt",
    ]);
    expect(result.label).toBe("Fictional recruiting practice—not professional experience");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("sourceSimulationId");
    expect(result).not.toHaveProperty("fictionalConfirmed");
  });
});