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

describe("strict expansion metadata", () => {
  it("accepts new record kinds while rejecting unknown keys and invalid domain values", () => {
    expect(isValidWorkspaceKindMetadata("research", {
      companyName: "Acme",
      role: "",
      sources: [{ label: "", url: "", checkedOn: "" }],
      questions: [""],
      reasons: [],
    })).toBe(true);
    expect(isValidWorkspaceKindMetadata("research", {
      companyName: "Acme",
      role: "",
      sources: [{ label: "source", url: "http://example.com", checkedOn: "" }],
      questions: [],
      reasons: [],
    })).toBe(false);
    expect(isValidWorkspaceKindMetadata("research", {
      companyName: "Acme",
      role: "",
      sources: [],
      questions: [],
      reasons: [],
      privateNotes: "not allowed",
    })).toBe(false);
    expect(isValidWorkspaceKindMetadata("network", {
      name: "A",
      organization: "",
      role: "",
      email: "not-an-email",
      profileUrl: "",
      lastContact: "2025-02-29",
      nextFollowUp: "",
      status: "planned",
    })).toBe(false);
    expect(isValidWorkspaceKindMetadata("offer", {
      company: "Acme",
      role: "",
      currency: "INR",
      annualSalary: null,
      annualBonus: null,
      hoursPerWeek: 0,
      location: "",
      arrangement: "",
      benefits: "",
      ratings: { salary: 1, benefits: 2, location: 3, hours: 4, growth: 5 },
    })).toBe(false);
    expect(isValidWorkspaceKindMetadata("offer", {
      company: "Acme",
      role: "",
      currency: "INR",
      annualSalary: null,
      annualBonus: 0,
      hoursPerWeek: null,
      location: "",
      arrangement: "",
      benefits: "",
      ratings: { salary: 1, benefits: 2, location: 3, hours: 4, growth: 5 },
    })).toBe(true);
  });
});