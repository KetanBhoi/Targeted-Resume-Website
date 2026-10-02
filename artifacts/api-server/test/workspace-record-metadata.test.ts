import { describe, expect, it } from "vitest";
import { isValidWorkspaceKindMetadata } from "../src/lib/workspace-record-metadata";

describe("typed simulation and practice metadata", () => {
  it("accepts written simulations and practice answers without requiring generated content", () => {
    expect(isValidWorkspaceKindMetadata("simulation", {
      scenarioId: "customer-escalation",
      stage: "opening",
    })).toBe(true);
    expect(isValidWorkspaceKindMetadata("practice", {
      question: "How would you prioritize these tasks?",
      category: "behavioral",
      duration: 20,
      checks: [true, false, true, false],
      reflection: "",
    })).toBe(true);
  });

  it("rejects malformed typed metadata and does not alter validation for other kinds", () => {
    expect(isValidWorkspaceKindMetadata("simulation", { scenarioId: "", stage: "opening" })).toBe(false);
    expect(isValidWorkspaceKindMetadata("simulation", {
      scenarioId: "scenario",
      stage: "opening",
      recording: "data",
    })).toBe(false);
    expect(isValidWorkspaceKindMetadata("practice", {
      question: "Question",
      category: "behavioral",
      duration: 10,
      checks: [true, false, true],
      reflection: "",
    })).toBe(false);
    expect(isValidWorkspaceKindMetadata("practice", {
      question: "Question",
      category: "behavioral",
      duration: 10.5,
      checks: [true, false, true, false],
      reflection: "",
    })).toBe(false);
    expect(isValidWorkspaceKindMetadata("resume", { legacyMetadata: true })).toBe(true);
  });
});