import { z } from "zod/v4";

const simulationMetadataSchema = z.object({
  scenarioId: z.string().trim().min(1).max(120),
  stage: z.string().trim().min(1).max(80),
}).strict();

const practiceMetadataSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(80),
  duration: z.number().int().min(1).max(1440),
  checks: z.array(z.boolean()).length(4),
  reflection: z.string().trim().max(5000),
}).strict();

const boundedText = (max: number, required = false) =>
  z.string().trim().max(max).refine((value) => !required || value.length > 0);
const optionalHttps = z.string().max(2048).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
});
const calendarDate = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
});
const researchMetadataSchema = z.object({
  companyName: boundedText(200, true),
  role: boundedText(200),
  sources: z.array(z.object({
    label: boundedText(200),
    url: optionalHttps,
    checkedOn: calendarDate,
  }).strict()).max(30),
  questions: z.array(boundedText(2000)).max(30),
  reasons: z.array(boundedText(2000)).max(30),
}).strict();
const networkMetadataSchema = z.object({
  name: boundedText(200, true),
  organization: boundedText(200),
  role: boundedText(200),
  email: z.string().trim().max(320).refine((value) => !value || z.email().safeParse(value).success),
  profileUrl: optionalHttps,
  lastContact: calendarDate,
  nextFollowUp: calendarDate,
  status: z.enum(["planned", "contacted", "replied", "paused"]),
}).strict();
const offerMetadataSchema = z.object({
  company: boundedText(200, true),
  role: boundedText(200),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "CAD", "AUD"]),
  annualSalary: z.number().min(0).nullable(),
  annualBonus: z.number().min(0).nullable(),
  hoursPerWeek: z.number().gt(0).nullable(),
  location: boundedText(200),
  arrangement: boundedText(100),
  benefits: boundedText(5000),
  ratings: z.object({
    salary: z.number().int().min(1).max(5),
    benefits: z.number().int().min(1).max(5),
    location: z.number().int().min(1).max(5),
    hours: z.number().int().min(1).max(5),
    growth: z.number().int().min(1).max(5),
  }).strict(),
}).strict();
const packMetadataSchema = z.object({
  reviewed: z.literal(true),
  resumeId: z.number().int().positive(),
  coverLetterId: z.number().int().positive().nullable(),
}).strict();

export function isValidWorkspaceKindMetadata(kind: string, metadata: unknown): boolean {
  if (kind === "simulation") return simulationMetadataSchema.safeParse(metadata).success;
  if (kind === "practice") return practiceMetadataSchema.safeParse(metadata).success;
  if (kind === "research") return researchMetadataSchema.safeParse(metadata).success;
  if (kind === "network") return networkMetadataSchema.safeParse(metadata).success;
  if (kind === "offer") return offerMetadataSchema.safeParse(metadata).success;
  if (kind === "pack") return packMetadataSchema.safeParse(metadata).success;
  return true;
}