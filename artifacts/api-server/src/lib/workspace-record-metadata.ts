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

export function isValidWorkspaceKindMetadata(kind: string, metadata: unknown): boolean {
  if (kind === "simulation") return simulationMetadataSchema.safeParse(metadata).success;
  if (kind === "practice") return practiceMetadataSchema.safeParse(metadata).success;
  return true;
}