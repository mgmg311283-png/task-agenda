import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  date: text("date").notNull().default("a definir"),
  person: text("person").notNull().default("a definir"),
  type: text("type").notNull().default("a_definir"), // accion | para_pensar | a_definir
  urgent: boolean("urgent").notNull().default(false),
  status: text("status").notNull().default("activa"), // activa | completada | eliminada
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const logs = pgTable("logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  taskId: serial("task_id"),
  originalValues: text("original_values"), // JSON string
  newValues: text("new_values"), // JSON string
  source: text("source").notNull().default("UI"), // UI | Chat | Audio | Import
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  timestamp: true,
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type LogEntry = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
