import { createInsertSchema } from "drizzle-zod";
import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const workspaceRecordsTable = pgTable(
  "workspace_records",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("workspace_records_owner_kind_created_idx").on(table.userId, table.kind, table.createdAt),
    index("workspace_records_owner_id_idx").on(table.userId, table.id),
  ],
);

export const insertWorkspaceRecordSchema = createInsertSchema(workspaceRecordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkspaceRecord = z.infer<typeof insertWorkspaceRecordSchema>;
export type WorkspaceRecord = typeof workspaceRecordsTable.$inferSelect;