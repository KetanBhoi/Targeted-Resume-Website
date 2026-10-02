import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const portfolioCaseStudiesTable = pgTable(
  "portfolio_case_studies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    sourceSimulationId: integer("source_simulation_id").notNull(),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    jobDescription: text("job_description").notNull().default(""),
    outreach: text("outreach").notNull().default(""),
    reasoning: text("reasoning").notNull().default(""),
    lessons: text("lessons").notNull().default(""),
    fictionalConfirmed: boolean("fictional_confirmed").notNull().default(false),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("portfolio_case_studies_owner_updated_idx").on(table.userId, table.updatedAt),
    index("portfolio_case_studies_public_idx").on(table.published, table.fictionalConfirmed, table.createdAt),
  ],
);

export const insertPortfolioCaseStudySchema = createInsertSchema(portfolioCaseStudiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPortfolioCaseStudy = z.infer<typeof insertPortfolioCaseStudySchema>;
export type PortfolioCaseStudy = typeof portfolioCaseStudiesTable.$inferSelect;