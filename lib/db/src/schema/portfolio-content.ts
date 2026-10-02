import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const portfolioContentTable = pgTable("portfolio_content", {
  id: text("id").primaryKey(),
  document: jsonb("document").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PortfolioContentRow = typeof portfolioContentTable.$inferSelect;