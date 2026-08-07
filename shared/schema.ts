import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Usuarios de la app. `role`: admin | supervisor | operario.
// El supervisor ve sus tareas + las de quienes lo tienen como supervisorId.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  pinHash: text("pin_hash").notNull(),
  role: text("role").notNull().default("operario"),
  supervisorId: integer("supervisor_id"),
  active: boolean("active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("users_supervisor_idx").on(t.supervisorId),
]);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  date: text("date").notNull().default("a definir"),
  person: text("person").notNull().default("a definir"),
  type: text("type").notNull().default("a_definir"), // accion | para_pensar | a_definir
  urgent: boolean("urgent").notNull().default(false),
  status: text("status").notNull().default("activa"), // activa | completada | eliminada
  starred: boolean("starred").notNull().default(false),
  priority: text("priority").default("normal"), // baja | normal | alta
  // `person` es texto libre historico y sirve de display. La autoridad para
  // permisos es assignedUserId — nunca filtrar permisos por `person`.
  assignedUserId: integer("assigned_user_id"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("tasks_status_idx").on(t.status),
  index("tasks_person_idx").on(t.person),
  index("tasks_date_idx").on(t.date),
  index("tasks_updated_at_idx").on(t.updatedAt),
  index("tasks_assigned_status_idx").on(t.assignedUserId, t.status),
]);

export const logs = pgTable("logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  // OJO: esto era serial("task_id"), lo que hacia que Postgres INVENTARA un
  // task_id via nextval() cada vez que una accion masiva logueaba sin tarea
  // puntual. Eso envenenaba la historia por tarea (pedir la historia de la
  // tarea #5 devolvia "movio 93 tareas vencidas"). Debe seguir siendo
  // integer nullable.
  taskId: integer("task_id"),
  userId: integer("user_id"),
  batchId: varchar("batch_id"),
  originalValues: text("original_values"), // JSON string
  newValues: text("new_values"), // JSON string
  source: text("source").notNull().default("UI"), // UI | Chat | Audio | Import
}, (t) => [
  index("logs_task_id_idx").on(t.taskId, t.timestamp),
  index("logs_user_id_idx").on(t.userId, t.timestamp),
  index("logs_batch_idx").on(t.batchId),
]);

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  text: z.string().min(1, "El texto de la tarea es requerido").max(500, "Máximo 500 caracteres"),
  date: z.string().optional().default("a definir"),
  person: z.string().optional().default("a definir"),
  priority: z.enum(['baja', 'normal', 'alta']).optional().default('normal'),
  starred: z.boolean().optional().default(false),
});

export const updateTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial().extend({
  text: z.string().min(1).max(500).optional(),
  priority: z.enum(['baja', 'normal', 'alta']).optional(),
  starred: z.boolean().optional(),
});

export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  timestamp: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  failedAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRole = "admin" | "supervisor" | "operario";

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type LogEntry = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
