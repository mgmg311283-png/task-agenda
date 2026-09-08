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
  // Ambos opcionales, texto libre. No se validan contra ningun enum.
  intention: text("intention"),
  nextStep: text("next_step"),
  // Atajo de la barra superior (1,2,3); NULL = tarea normal. Un atajo ES una
  // tarea para poder reusar el cronometro tal cual (time_entries.task_id es
  // NOT NULL y apunta aca), pero se esconde del tablero: es una categoria
  // recurrente ("Interrupciones") que nunca se completa, no trabajo a triar.
  quickSlot: integer("quick_slot"),
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

// Medición de tiempo. Tabla aparte (y no un contador en `tasks`) para poder
// responder cuándo se trabajó, no solo cuánto: un total suelto no sirve para
// analizar en qué se va el tiempo.
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  autoClosed: boolean("auto_closed").notNull().default(false),
  source: text("source").notNull().default("UI"),
}, (t) => [
  index("time_entries_user_started_idx").on(t.userId, t.startedAt),
  index("time_entries_task_idx").on(t.taskId),
]);

export type TimeEntry = typeof timeEntries.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // No se setea desde la API: los atajos se definen por migracion, si no
  // cualquier alta comun podria robarse un boton de la barra.
  quickSlot: true,
}).extend({
  text: z.string().trim().min(1, "El texto de la tarea es requerido").max(500, "Máximo 500 caracteres"),
  date: z.string().optional().default("a definir"),
  person: z.string().optional().default("a definir"),
  priority: z.enum(['baja', 'normal', 'alta']).optional().default('normal'),
  starred: z.boolean().optional().default(false),
  intention: z.string().max(1000).optional(),
  nextStep: z.string().max(1000).optional(),
});

export const updateTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  quickSlot: true,
}).partial().extend({
  text: z.string().min(1).max(500).optional(),
  priority: z.enum(['baja', 'normal', 'alta']).optional(),
  starred: z.boolean().optional(),
  intention: z.string().max(1000).optional(),
  nextStep: z.string().max(1000).optional(),
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
