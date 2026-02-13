import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTaskSchema, updateTaskSchema } from "@shared/schema";
import { parse, isValid, isBefore, startOfDay, format } from "date-fns";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ---- TASKS ----

  // Get all active tasks
  app.get("/api/tasks", async (_req, res) => {
    const tasks = await storage.getActiveTasks();
    res.json(tasks);
  });

  // Get all tasks (including completed/deleted) for metrics
  app.get("/api/tasks/all", async (_req, res) => {
    const tasks = await storage.getAllTasks();
    res.json(tasks);
  });

  // Get next available ID
  app.get("/api/tasks/next-id", async (_req, res) => {
    const nextId = await storage.getNextId();
    res.json({ nextId });
  });

  // Create a task
  app.post("/api/tasks", async (req, res) => {
    try {
      const parsed = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(parsed);

      await storage.createLog({
        action: "CREATE",
        details: `Created task #${task.id}: "${task.text}"`,
        taskId: task.id,
        newValues: JSON.stringify(task),
        source: req.body.source || "UI",
      });

      res.status(201).json(task);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Update a task
  app.patch("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const original = await storage.getTaskById(id);
      if (!original) return res.status(404).json({ message: "Task not found" });

      const parsed = updateTaskSchema.parse(req.body);
      const task = await storage.updateTask(id, parsed);

      await storage.createLog({
        action: "UPDATE",
        details: `Updated task #${id}`,
        taskId: id,
        originalValues: JSON.stringify(original),
        newValues: JSON.stringify(task),
        source: req.body.source || "UI",
      });

      res.json(task);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Complete a task
  app.post("/api/tasks/:id/complete", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const task = await storage.completeTask(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    await storage.createLog({
      action: "COMPLETE",
      details: `Completed task #${id}: "${task.text}"`,
      taskId: id,
      source: req.body?.source || "UI",
    });

    res.json(task);
  });

  // Delete a task (soft delete)
  app.post("/api/tasks/:id/delete", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const task = await storage.deleteTask(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    await storage.createLog({
      action: "DELETE",
      details: `Deleted task #${id}: "${task.text}"`,
      taskId: id,
      source: req.body?.source || "UI",
    });

    res.json(task);
  });

  // Move expired tasks to today
  app.post("/api/tasks/move-expired", async (req, res) => {
    const today = startOfDay(new Date());
    const todayStr = format(today, "dd/MM/yy");

    // Get all active tasks with real dates
    const activeTasks = await storage.getActiveTasks();
    let count = 0;

    for (const task of activeTasks) {
      if (task.date === "a definir") continue;
      try {
        const taskDate = parse(task.date, "dd/MM/yy", new Date());
        if (isValid(taskDate) && isBefore(taskDate, today)) {
          await storage.updateTask(task.id, { date: todayStr });
          count++;
        }
      } catch {
        // Skip invalid dates
      }
    }

    if (count > 0) {
      await storage.createLog({
        action: "MOVE_EXPIRED",
        details: `Moved ${count} expired tasks to today (${todayStr})`,
        source: req.body?.source || "UI",
      });
    }

    res.json({ moved: count, date: todayStr });
  });

  // Delete all active tasks
  app.post("/api/tasks/delete-all", async (req, res) => {
    const count = await storage.deleteAllActive();

    await storage.createLog({
      action: "DELETE_ALL",
      details: `Deleted ${count} active tasks`,
      source: req.body?.source || "UI",
    });

    res.json({ deleted: count });
  });

  // Import tasks (bulk create)
  app.post("/api/tasks/import", async (req, res) => {
    try {
      const tasksData = req.body.tasks;
      if (!Array.isArray(tasksData) || tasksData.length === 0) {
        return res.status(400).json({ message: "No tasks provided" });
      }

      const validTasks = tasksData.map((t: any) => ({
        text: t.text || "Sin título",
        date: t.date || "a definir",
        person: t.person || "a definir",
        type: t.type || "a_definir",
        urgent: t.urgent || false,
        status: "activa",
      }));

      const created = await storage.importTasks(validTasks);

      await storage.createLog({
        action: "IMPORT",
        details: `Imported ${created.length} tasks`,
        source: "Import",
      });

      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ---- LOGS ----

  app.get("/api/logs", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 200;
    const logEntries = await storage.getLogs(limit);
    res.json(logEntries);
  });

  return httpServer;
}
