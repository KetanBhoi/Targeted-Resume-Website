import { describe, expect, it } from "vitest";
import {
  defaultPortfolioContent,
  isSafeHttpsUrl,
  isValidCalendarDate,
  isValidTimezone,
  publicPortfolioContent,
  validatePortfolioContent,
} from "../src/lib/portfolio-content";

describe("portfolio content validation and public filtering", () => {
  it("provides safe defaults and only exposes published content", () => {
    expect(defaultPortfolioContent.booking).toEqual({
      enabled: false,
      url: "",
      timezone: "Asia/Kolkata",
      availability: "",
    });
    const document = {
      booking: {
        enabled: false,
        url: "https://booking.example.test/private",
        timezone: "America/Los_Angeles",
        availability: "Draft scheduling details",
      },
      availability: {
        published: false,
        roles: "Private role targets",
        workArrangement: "Hybrid",
        locations: "Private location",
        joining: "Immediately",
      },
      certificates: [
        {
          id: "published-cert",
          title: "Course",
          issuer: "Provider",
          completed: "2025-02-28",
          verificationUrl: "",
          published: true,
        },
        {
          id: "draft-cert",
          title: "Draft",
          issuer: "",
          completed: "",
          verificationUrl: "",
          published: false,
        },
      ],
      recommendations: [
        {
          id: "approved",
          author: "Colleague",
          relationship: "Peer",
          text: "A consented and approved recommendation.",
          consent: true,
          approved: true,
          published: true,
        },
        {
          id: "not-approved",
          author: "Colleague",
          relationship: "Peer",
          text: "Not yet approved.",
          consent: true,
          approved: false,
          published: false,
        },
      ],
    };
    const validated = validatePortfolioContent(document);
    if (!validated.success) throw new Error(validated.error);
    expect(validated.success).toBe(true);
    if (!validated.success) return;
    const publicContent = publicPortfolioContent(validated.data);
    expect(publicContent.booking).toEqual({
      enabled: false,
      url: "",
      timezone: "UTC",
      availability: "",
    });
    expect(publicContent.availability).toEqual({
      published: false,
      roles: "",
      workArrangement: "",
      locations: "",
      joining: "",
    });
    expect(publicContent.certificates.map(({ id }) => id)).toEqual(["published-cert"]);
    expect(publicContent.recommendations.map(({ id }) => id)).toEqual(["approved"]);
    expect(publicPortfolioContent({
      ...validated.data,
      recommendations: [
        ...validated.data.recommendations,
        {
          id: "no-consent",
          author: "Colleague",
          relationship: "Peer",
          text: "No consent.",
          consent: false,
          approved: true,
          published: true,
        },
        {
          id: "no-approval",
          author: "Colleague",
          relationship: "Peer",
          text: "No approval.",
          consent: true,
          approved: false,
          published: true,
        },
      ],
    }).recommendations.map(({ id }) => id)).toEqual(["approved"]);
  });

  it("rejects invalid dates, unsafe URLs, and non-IANA timezones", () => {
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
    expect(isValidCalendarDate("2025-02-29")).toBe(false);
    expect(isValidCalendarDate("2025-2-03")).toBe(false);
    expect(isSafeHttpsUrl("https://certs.example.test/verify")).toBe(true);
    expect(isSafeHttpsUrl("http://certs.example.test/verify")).toBe(false);
    expect(isSafeHttpsUrl("https://user:pass@certs.example.test/")).toBe(false);
    expect(isSafeHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    const enabledWithoutAvailability = structuredClone(defaultPortfolioContent);
    enabledWithoutAvailability.booking.enabled = true;
    expect(validatePortfolioContent(enabledWithoutAvailability).success).toBe(false);
  });

  it("requires published certificate evidence and recommendation consent gates", () => {
    const valid = structuredClone(defaultPortfolioContent);
    valid.certificates = [{
      id: "certificate",
      title: "Credential",
      issuer: "Issuer",
      completed: "2025-04-10",
      verificationUrl: "https://verify.example.test/cert",
      published: true,
    }];
    valid.recommendations = [{
      id: "recommendation",
      author: "Colleague",
      relationship: "Manager",
      text: "A positive note.",
      consent: true,
      approved: true,
      published: true,
    }];
    expect(validatePortfolioContent(valid).success).toBe(true);

    const withoutConsent = structuredClone(valid);
    withoutConsent.recommendations[0].consent = false;
    expect(validatePortfolioContent(withoutConsent).success).toBe(false);

    const noApproval = structuredClone(valid);
    noApproval.recommendations[0].approved = false;
    expect(validatePortfolioContent(noApproval).success).toBe(false);

    const invalidDate = structuredClone(valid);
    invalidDate.certificates[0].completed = "2025-04-31";
    expect(validatePortfolioContent(invalidDate).success).toBe(false);
  });
});