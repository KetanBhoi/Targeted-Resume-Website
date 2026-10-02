import { expect, it } from "vitest";
import { hasVerifiedOwnerEmail } from "../src/lib/portfolio-owner";

it("requires a verified matching email from Clerk for owner access", () => {
  const owner = "owner@example.com";
  expect(hasVerifiedOwnerEmail([{ emailAddress: owner, verification: { status: "verified" } }], owner)).toBe(true);
  expect(hasVerifiedOwnerEmail([{ emailAddress: "OWNER@example.com", verification: { status: "verified" } }], ` ${owner} `)).toBe(true);
  expect(hasVerifiedOwnerEmail([{ emailAddress: owner, verification: { status: "unverified" } }], owner)).toBe(false);
  expect(hasVerifiedOwnerEmail([{ emailAddress: "visitor@example.com", verification: { status: "verified" } }], owner)).toBe(false);
  expect(hasVerifiedOwnerEmail([{ emailAddress: owner }], owner)).toBe(false);
  expect(hasVerifiedOwnerEmail([], owner)).toBe(false);
  expect(hasVerifiedOwnerEmail([{ emailAddress: owner, verification: { status: "verified" } }], undefined)).toBe(false);
  expect(hasVerifiedOwnerEmail([{ emailAddress: owner, verification: { status: "verified" } }], " ")).toBe(false);
});