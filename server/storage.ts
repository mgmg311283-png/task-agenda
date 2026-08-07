import { eq, and, or, desc, asc, sql, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  tasks, logs, users,
  type Task, type InsertTask, type UpdateTask,
  type LogEntry, type InsertLog,
  type User, type InsertUser,
} from "@shared/schema";
import type { Scope } from "./auth";

// Exportado para que connect-pg-simple reuse el mismo pool en vez de abrir otro.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

/**
 * Filtro de visibilidad. Es la unica autoridad de permisos sobre tareas:
 *  - admin      -> ve todo, incluida la bandeja sin asignar
 *  - supervisor -> ve lo suyo + lo de su equipo
 *  - operario   -> ve solo lo suyo
 * Las tareas sin asignar (assigned_user_id NULL) las ve solo el admin.
 * OJO: nunca filtrar por `person`, que es texto libre y editable.
 */
function scopeWhere(scope: Scope) {
  if (scope.role === "admin") return undefined;
  const ids = scope.role === "supervisor"
    ? Array.from(new Set([scope.userId, ...scope.teamIds]))
    : [scope.userId];
  return inArray(tasks.assignedUserId, ids);
}

export class DatabaseStorage {
  // ── Tareas ─────────────────────────────────────────────────────────────
  async getActiveTasks(scope: Scope): Promise<Task[]> {
    const base = eq(tasks.status, "activa");
    const s = scopeWhere(scope);
    return db.select().from(tasks).where(s ? and(base, s) : base);
  }

  async getAllTasks(scope: Scope): Promise<Task[]> {
    const s = scopeWhere(scope);
    return s ? db.select().from(tasks).where(s) : db.select().from(tasks);
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  /**
   * Devuelve la tarea solo si el scope puede verla; si no, undefined.
   * Se responde 404 (no 403) para no revelar la existencia de tareas ajenas.
   */
  async getTaskForScope(id: number, scope: Scope): Promise<Task | undefined> {
    const task = await this.getTaskById(id);
    if (!task) return undefined;
    if (scope.role === "admin") return task;
    if (task.assignedUserId == null) return undefined; // bandeja: solo admin
    if (task.assignedUserId === scope.userId) return task;
    if (scope.role === "supervisor" && scope.teamIds.includes(task.assignedUserId)) {
      return task;
    }
    return undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async updateTask(id: number, updates: UpdateTask): Promise<Task | undefined> {
    const result = await db.update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async deleteTask(id: number): Promise<Task | undefined> {
    return this.updateTask(id, { status: "eliminada" });
  }

  async completeTask(id: number): Promise<Task | undefined> {
    return this.updateTask(id, { status: "completada" });
  }

  async deleteAllActive(scope: Scope): Promise<Task[]> {
    const base = eq(tasks.status, "activa");
    const s = scopeWhere(scope);
    return db.update(tasks)
      .set({ status: "eliminada", updatedAt: new Date() })
      .where(s ? and(base, s) : base)
      .returning();
  }

  async importTasks(tasksData: InsertTask[]): Promise<Task[]> {
    if (tasksData.length === 0) return [];
    return db.insert(tasks).values(tasksData).returning();
  }

  async getNextId(): Promise<number> {
    const result = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(tasks);
    return (result[0]?.maxId || 0) + 1;
  }

  // ── Logs ───────────────────────────────────────────────────────────────
  async getLogs(limit = 200, scope?: Scope): Promise<LogEntry[]> {
    // Un no-admin solo ve los logs de tareas que puede ver. Los logs sin
    // tarea (acciones masivas viejas) son globales -> solo admin.
    if (!scope || scope.role === "admin") {
      return db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
    }
    const ids = scope.role === "supervisor"
      ? Array.from(new Set([scope.userId, ...scope.teamIds]))
      : [scope.userId];
    const visible = db.select({ id: tasks.id }).from(tasks)
      .where(inArray(tasks.assignedUserId, ids));
    return db.select().from(logs)
      .where(inArray(logs.taskId, visible))
      .orderBy(desc(logs.timestamp))
      .limit(limit);
  }

  async createLog(log: InsertLog): Promise<LogEntry> {
    const result = await db.insert(logs).values(log).returning();
    return result[0];
  }

  async createLogs(entries: InsertLog[]): Promise<void> {
    if (entries.length === 0) return;
    await db.insert(logs).values(entries);
  }

  /** Historia completa de una tarea, con el nombre de quien hizo cada cambio. */
  async getTaskHistory(taskId: number) {
    return db.select({
      id: logs.id,
      timestamp: logs.timestamp,
      action: logs.action,
      details: logs.details,
      source: logs.source,
      batchId: logs.batchId,
      originalValues: logs.originalValues,
      newValues: logs.newValues,
      userId: logs.userId,
      userName: users.displayName,
    })
      .from(logs)
      .leftJoin(users, eq(logs.userId, users.id))
      .where(eq(logs.taskId, taskId))
      .orderBy(asc(logs.timestamp));
  }

  // ── Usuarios ───────────────────────────────────────────────────────────
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users)
      .where(sql`lower(${users.username}) = lower(${username})`);
    return result[0];
  }

  async getUserById(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.displayName));
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  /** ids de quienes reportan a este supervisor */
  async getTeamIds(supervisorId: number): Promise<number[]> {
    const rows = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.supervisorId, supervisorId), eq(users.active, true)));
    return rows.map((r) => r.id);
  }

  async registerLoginSuccess(id: number): Promise<void> {
    await db.update(users)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async registerLoginFailure(id: number, attempts: number, lockedUntil: Date | null): Promise<void> {
    await db.update(users)
      .set({ failedAttempts: attempts, lockedUntil })
      .where(eq(users.id, id));
  }
}

export const storage = new DatabaseStorage();
