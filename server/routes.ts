import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTaskSchema, updateTaskSchema } from "@shared/schema";
import { parse, isValid, isBefore, startOfDay, format } from "date-fns";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseTaskDate(dateStr: string): Date | null {
  const formats = ["dd/MM/yy", "dd/MM/yyyy"];
  for (const fmt of formats) {
    try {
      const d = parse(dateStr, fmt, new Date());
      if (isValid(d)) return d;
    } catch {}
  }
  return null;
}

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

    const activeTasks = await storage.getActiveTasks();
    let count = 0;

    const todayStr = format(today, "dd/MM/yy");

    for (const task of activeTasks) {
      if (task.date === "a definir") {
        await storage.updateTask(task.id, { date: todayStr });
        count++;
        continue;
      }
      const taskDate = parseTaskDate(task.date);
      if (taskDate && isBefore(taskDate, today)) {
        const todayFmt = task.date.length > 8
          ? format(today, "dd/MM/yyyy")
          : format(today, "dd/MM/yy");
        await storage.updateTask(task.id, { date: todayFmt });
        count++;
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

  // ---- AI PARSE ----

  app.post("/api/parse", async (req, res) => {
    try {
      const { text, existingTaskIds } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }

      const today = format(new Date(), "dd/MM/yy");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Sos un asistente de gestión de tareas para una app de productividad en español argentino.

Tu trabajo es interpretar texto dictado por voz o pegado y convertirlo en acciones estructuradas.

HOY es: ${today}

ACCIONES posibles:
- "create": crear una nueva tarea
- "complete": completar una tarea existente (necesita id)
- "delete": eliminar una tarea existente (necesita id)
- "update": modificar una tarea existente (necesita id)
- "move_expired": mover tareas vencidas a hoy
- "export": exportar tareas

TIPOS de tarea:
- "accion": tarea con acción concreta (si tiene fecha, es acción)
- "para_pensar": idea o cosa para pensar/evaluar
- "a_definir": no queda claro

FORMATO de fecha: dd/mm/yy (ej: 15/03/26)

PERSONAS conocidas: Mariano, Aldana (si no se menciona persona, usar "a definir")

REGLAS IMPORTANTES:
1. Si el usuario dice algo con "y" como conector dentro de UNA misma tarea, NO lo separes en dos. Ejemplo: "comprar pan y leche" es UNA sola tarea.
2. Solo separá en múltiples tareas si claramente son cosas distintas e independientes. Ejemplo: "comprar pan. llamar al doctor" son DOS tareas.
3. Si dice "punto" o hay una pausa clara entre ideas distintas, ahí sí separá.
4. El texto puede tener errores de dictado por voz, interpretá la intención.
5. Si menciona "urgente", "ya", "ahora", "prioridad", "asap" → marcar urgent: true
6. Limpiar el texto de la tarea: no incluir palabras como "agregar tarea", "anotar", etc. Solo la descripción de lo que hay que hacer.
7. Las fechas relativas como "mañana", "el lunes", "la semana que viene" deben convertirse al formato dd/mm/yy.

IDs de tareas existentes: ${JSON.stringify(existingTaskIds || [])}

Responde SIEMPRE con un JSON con esta estructura:
{
  "actions": [
    {
      "action": "create",
      "text": "descripción limpia de la tarea",
      "date": "dd/mm/yy" o "a definir",
      "person": "nombre" o "a definir",
      "type": "accion" | "para_pensar" | "a_definir",
      "urgent": false
    }
  ],
  "summary": "breve resumen en español de lo que se hizo"
}`
          },
          {
            role: "user",
            content: text,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ message: "No response from AI" });
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(500).json({ message: "AI returned invalid response" });
      }

      const validActions = ['create', 'complete', 'delete', 'update', 'move_expired', 'export'];
      const validTypes = ['accion', 'para_pensar', 'a_definir'];
      
      const actions = (parsed.actions || [])
        .filter((a: any) => validActions.includes(a.action))
        .map((a: any) => ({
          action: a.action,
          ...(a.id ? { id: Number(a.id) } : {}),
          ...(a.text ? { text: String(a.text).trim() } : {}),
          date: a.date || 'a definir',
          person: a.person || 'a definir',
          type: validTypes.includes(a.type) ? a.type : 'a_definir',
          urgent: Boolean(a.urgent),
        }));

      res.json({ actions, summary: parsed.summary || '' });
    } catch (e: any) {
      console.error("AI parse error:", e);
      res.status(500).json({ message: "Error processing with AI: " + e.message });
    }
  });

  return httpServer;
}
