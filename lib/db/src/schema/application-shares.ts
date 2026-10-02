import { createInsertSchema } from "drizzle-zod";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const applicationSharesTable = pgTable(
  "application_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    packRecordId: integer("pack_record_id").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    title: text("title").notNull(),
  },
  (table) => [
    uniqueIndex("application_shares_token_hash_unique").on(table.tokenHash),
    index("application_shares_owner_created_idx").on(table.userId, table.createdAt),
    index("application_shares_owner_pack_idx").on(table.userId, table.packRecordId),
  ],
);

export const insertApplicationShareSchema = createInsertSchema(applicationSharesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertApplicationShare = z.infer<typeof insertApplicationShareSchema>;
export type ApplicationShare = typeof applicationSharesTable.$inferSelect;