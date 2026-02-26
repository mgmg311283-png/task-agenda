import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { tasks, logs, type Task, type InsertTask, type UpdateTask, type LogEntry, type InsertLog } from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  // Tasks
  getActiveTasks(): Promise<Task[]>;
  getAllTasks(): Promise<Task[]>;
  getTaskById(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: UpdateTask): Promise<Task | undefined>;
  deleteTask(id: number): Promise<Task | undefined>;
  completeTask(id: number): Promise<Task | undefined>;
  deleteAllActive(): Promise<number>;
  importTasks(tasksData: InsertTask[]): Promise<Task[]>;
  getNextId(): Promise<number>;

  // Logs
  getLogs(limit?: number): Promise<LogEntry[]>;
  createLog(log: InsertLog): Promise<LogEntry>;
}

export class DatabaseStorage implements IStorage {
  async getActiveTasks(): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.status, "activa"));
  }

  async getAllTasks(): Promise<Task[]> {
    return db.select().from(tasks);
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
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

  async deleteAllActive(): Promise<number> {
    const result = await db.update(tasks)
      .set({ status: "eliminada", updatedAt: new Date() })
      .where(eq(tasks.status, "activa"))
      .returning();
    return result.length;
  }

  async importTasks(tasksData: InsertTask[]): Promise<Task[]> {
    if (tasksData.length === 0) return [];
    const result = await db.insert(tasks).values(tasksData).returning();
    return result;
  }

  async getNextId(): Promise<number> {
    const result = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(tasks);
    return (result[0]?.maxId || 0) + 1;
  }

  // Logs
  async getLogs(limit = 200): Promise<LogEntry[]> {
    return db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
  }

  async createLog(log: InsertLog): Promise<LogEntry> {
    const result = await db.insert(logs).values(log).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
