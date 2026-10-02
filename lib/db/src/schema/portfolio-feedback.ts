import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const portfolioFeedbackTable = pgTable("portfolio_feedback", {
  id: serial("id").primaryKey(),
  roleView: text("role_view").notNull(),
  signal: text("signal").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("portfolio_feedback_created_idx").on(table.createdAt)]);

export const insertPortfolioFeedbackSchema = createInsertSchema(portfolioFeedbackTable).omit({ id: true, createdAt: true });
export type InsertPortfolioFeedback = z.infer<typeof insertPortfolioFeedbackSchema>;
export type PortfolioFeedback = typeof portfolioFeedbackTable.$inferSelect;