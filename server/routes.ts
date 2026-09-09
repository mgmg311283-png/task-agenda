import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "node:crypto";
import { storage } from "./storage";
import { requireAuth, requireAdmin, getScope } from "./auth";
import { diffLog, describeAction } from "./audit";
import { insertTaskSchema, updateTaskSchema } from "@shared/schema";
import { parse, isValid, isBefore, startOfDay, format, addDays, isSameDay } from "date-fns";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // El default del SDK son 10 minutos: una llamada colgada dejaba la request
  // de express (y su conexion) tomada todo ese tiempo.
  timeout: 30_000,
  maxRetries: 1,
});

const parseRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Demasiadas solicitudes. Esperá un minuto." },
});

// Las escrituras no tenian ningun limite: un cliente en loop (o una pestaña
// colgada reintentando) podia martillar la base sin freno. El limite es alto
// a proposito para no molestar al uso normal, incluidas las acciones masivas.
const writeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  message: { message: "Demasiadas operaciones seguidas. Esperá un momento." },
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

  // Get all active tasks (filtradas por scope del usuario)
  app.get("/api/tasks", requireAuth, async (req, res) => {
    const tasks = await storage.getActiveTasks(getScope(req));
    res.json(tasks);
  });

  // Get all tasks (including completed/deleted) for metrics
  app.get("/api/tasks/all", requireAuth, async (req, res) => {
    const tasks = await storage.getAllTasks(getScope(req));
    res.json(tasks);
  });

  // Get next available ID
  app.get("/api/tasks/next-id", requireAuth, async (_req, res) => {
    const nextId = await storage.getNextId();
    res.json({ nextId });
  });

  // Create a task
  app.post("/api/tasks", requireAuth, writeRateLimit, async (req, res) => {
    try {
      const scope = getScope(req);
      const parsed = insertTaskSchema.parse(req.body);

      // Un no-admin solo puede crear tareas para si mismo: se ignora lo que
      // venga en el body para no permitir asignarle trabajo a otro.
      const values: any = { ...parsed, createdByUserId: scope.userId };
      if (scope.role !== "admin") {
        values.assignedUserId = scope.userId;
        const me = await storage.getUserById(scope.userId);
        if (me) values.person = me.displayName;
      }

      const task = await storage.createTask(values);

      await storage.createLog({
        action: "CREATE",
        details: `Created task #${task.id}: "${task.text}"`,
        taskId: task.id,
        userId: scope.userId,
        newValues: JSON.stringify(task),
        source: req.body.source || "UI",
      });

      res.status(201).json(task);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Historia completa de una tarea (quien cambio que y cuando)
  app.get("/api/tasks/:id/history", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const task = await storage.getTaskForScope(id, getScope(req));
    if (!task) return res.status(404).json({ message: "Task not found" });

    const raw = await storage.getTaskHistory(id);
    const events = raw.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      action: e.action,
      actionLabel: describeAction(e.action),
      details: e.details,
      source: e.source,
      batchId: e.batchId,
      // Los logs anteriores al login no tienen autor: se muestra asi, en vez
      // de atribuirselos a alguien.
      user: e.userId ? { id: e.userId, name: e.userName } : null,
      // En una creacion los "cambios" son en realidad los valores iniciales,
      // y listarlos como cambios confunde ("Se editó el texto" al crearla).
      changes: e.action === "CREATE" ? [] : diffLog(e),
    }));
    res.json({ task, events });
  });

  // Update a task
  app.patch("/api/tasks/:id", requireAuth, writeRateLimit, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const scope = getScope(req);
      // getTaskForScope (no getTaskById): valida que la tarea sea VISIBLE
      // para este usuario, no solo que exista. Devuelve 404 en vez de 403
      // para no revelar la existencia de tareas ajenas.
      const original = await storage.getTaskForScope(id, scope);
      if (!original) return res.status(404).json({ message: "Task not found" });

      const parsed: any = updateTaskSchema.parse(req.body);
      // Un no-admin no puede reasignar tareas (ni regalarlas ni robarlas).
      if (scope.role !== "admin") {
        delete parsed.assignedUserId;
        delete parsed.person;
        delete parsed.createdByUserId;
      }
      const task = await storage.updateTask(id, parsed);

      await storage.createLog({
        action: "UPDATE",
        details: `Updated task #${id}`,
        taskId: id,
        userId: scope.userId,
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
  app.post("/api/tasks/:id/complete", requireAuth, writeRateLimit, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const scope = getScope(req);
    const original = await storage.getTaskForScope(id, scope);
    if (!original) return res.status(404).json({ message: "Task not found" });

    const task = await storage.completeTask(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    await storage.createLog({
      action: "COMPLETE",
      details: `Completed task #${id}: "${task.text}"`,
      taskId: id,
      userId: scope.userId,
      originalValues: JSON.stringify(original),
      newValues: JSON.stringify(task),
      source: req.body?.source || "UI",
    });

    res.json(task);
  });

  // Delete a task (soft delete)
  app.delete("/api/tasks/:id", requireAuth, writeRateLimit, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const scope = getScope(req);
    const original = await storage.getTaskForScope(id, scope);
    if (!original) return res.status(404).json({ message: "Task not found" });

    const task = await storage.deleteTask(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    await storage.createLog({
      action: "DELETE",
      details: `Deleted task #${id}: "${task.text}"`,
      taskId: id,
      userId: scope.userId,
      originalValues: JSON.stringify(original),
      newValues: JSON.stringify(task),
      source: req.body?.source || "UI",
    });

    res.json(task);
  });

  // Move expired tasks to today
  app.post("/api/tasks/move-expired", requireAuth, writeRateLimit, async (req, res) => {
    // Igual que push-today: el server esta en UTC y los usuarios en UTC-3, asi
    // que despues de las 21:00 hora local "hoy" no coincidia. El cliente manda
    // su propio dia; si no lo manda, se cae al del servidor como antes.
    const clientToday = typeof req.body?.today === "string"
      ? parseTaskDate(req.body.today)
      : null;
    const today = startOfDay(clientToday ?? new Date());
    const scope = getScope(req);

    const activeTasks = await storage.getActiveTasks(scope);
    const changes: { id: number; before: string; after: string }[] = [];

    const todayStr = format(today, "dd/MM/yy");

    // Se agrupan por fecha destino (a lo sumo dos: dd/MM/yy y dd/MM/yyyy) y se
    // aplica un UPDATE por grupo, en vez de uno por tarea dentro del loop.
    const byTarget = new Map<string, number[]>();
    const queue = (target: string, task: { id: number; date: string }) => {
      if (!byTarget.has(target)) byTarget.set(target, []);
      byTarget.get(target)!.push(task.id);
      changes.push({ id: task.id, before: task.date, after: target });
    };

    for (const task of activeTasks) {
      if (task.date === "a definir") {
        queue(todayStr, task);
        continue;
      }
      const taskDate = parseTaskDate(task.date);
      if (taskDate && isBefore(taskDate, today)) {
        queue(
          task.date.length > 8 ? format(today, "dd/MM/yyyy") : format(today, "dd/MM/yy"),
          task,
        );
      }
    }

    for (const [target, ids] of Array.from(byTarget.entries())) {
      await storage.updateTasksBulk(ids, { date: target });
    }

    // Una fila de log POR TAREA (antes se guardaba un solo log agregado y se
    // descartaba el detalle, que es justamente el dato de "cuando se paso de
    // fecha y a que fecha"). El batchId las agrupa como un unico evento.
    if (changes.length > 0) {
      const batchId = randomUUID();
      await storage.createLogs(
        changes.map((c) => ({
          action: "MOVE_EXPIRED",
          details: `Tarea #${c.id}: ${c.before} → ${c.after}`,
          taskId: c.id,
          batchId,
          userId: scope.userId,
          originalValues: JSON.stringify({ date: c.before }),
          newValues: JSON.stringify({ date: c.after }),
          source: req.body?.source || "UI",
        })),
      );
    }

    res.json({ moved: changes.length, date: todayStr, changes });
  });

  // Move all urgent tasks to action
  app.post("/api/tasks/urgent-to-action", requireAuth, writeRateLimit, async (req, res) => {
    const scope = getScope(req);
    const activeTasks = await storage.getActiveTasks(scope);
    const changes: { id: number; beforeType: string }[] = [];

    // Todas reciben exactamente el mismo cambio: un solo UPDATE alcanza.
    for (const task of activeTasks) {
      if (task.urgent === true) {
        changes.push({ id: task.id, beforeType: task.type });
      }
    }
    await storage.updateTasksBulk(changes.map((c) => c.id), { urgent: false, type: 'accion' });

    if (changes.length > 0) {
      const batchId = randomUUID();
      await storage.createLogs(
        changes.map((c) => ({
          action: "MOVE_URGENT_TO_ACTION",
          details: `Tarea #${c.id}: urgente → acción`,
          taskId: c.id,
          batchId,
          userId: scope.userId,
          originalValues: JSON.stringify({ urgent: true, type: c.beforeType }),
          newValues: JSON.stringify({ urgent: false, type: "accion" }),
          source: req.body?.source || "UI",
        })),
      );
    }

    res.json({ moved: changes.length, changes });
  });

  // Pasa a mañana las tareas URGENTES que vencen HOY (las que la UI
  // muestra en verde en esa columna). Accion y Para pensar quedan como estan
  // a proposito. Espejo de move-expired: mismo patron de scope, de
  // batchId en el log y de `changes` para que el cliente registre UNA sola
  // entrada de undo en vez de una por tarea.
  app.post("/api/tasks/push-today", requireAuth, writeRateLimit, async (req, res) => {
    // El servidor corre en UTC y los usuarios estan en UTC-3: entre las 21:00
    // y medianoche hora local, `new Date()` aca ya es el dia siguiente. Si el
    // server decidiera solo, moveria un conjunto distinto al que el boton
    // conto y mostro en pantalla. Por eso el cliente manda SU dia de hoy.
    const clientToday = typeof req.body?.today === "string"
      ? parseTaskDate(req.body.today)
      : null;
    const today = startOfDay(clientToday ?? new Date());
    const tomorrow = addDays(today, 1);
    const scope = getScope(req);

    const activeTasks = await storage.getActiveTasks(scope);
    const changes: { id: number; before: string; after: string }[] = [];

    const byTargetPush = new Map<string, number[]>();
    for (const task of activeTasks) {
      if (task.urgent !== true) continue;
      if (task.date === "a definir") continue;
      const taskDate = parseTaskDate(task.date);
      if (!taskDate || !isSameDay(taskDate, today)) continue;

      // Respetar el formato de año que ya traia la tarea (yy vs yyyy).
      const tomorrowFmt = task.date.length > 8
        ? format(tomorrow, "dd/MM/yyyy")
        : format(tomorrow, "dd/MM/yy");
      if (!byTargetPush.has(tomorrowFmt)) byTargetPush.set(tomorrowFmt, []);
      byTargetPush.get(tomorrowFmt)!.push(task.id);
      changes.push({ id: task.id, before: task.date, after: tomorrowFmt });
    }

    for (const [target, ids] of Array.from(byTargetPush.entries())) {
      await storage.updateTasksBulk(ids, { date: target });
    }

    if (changes.length > 0) {
      const batchId = randomUUID();
      await storage.createLogs(
        changes.map((c) => ({
          action: "PUSH_TODAY",
          details: `Tarea #${c.id}: ${c.before} → ${c.after}`,
          taskId: c.id,
          batchId,
          userId: scope.userId,
          originalValues: JSON.stringify({ date: c.before }),
          newValues: JSON.stringify({ date: c.after }),
          source: req.body?.source || "UI",
        })),
      );
    }

    res.json({ moved: changes.length, date: format(tomorrow, "dd/MM/yy"), changes });
  });

  // Delete all active tasks — solo admin y con confirmacion explicita.
  // Historicamente esto se disparo por accidente y borro tareas reales.
  app.post("/api/tasks/delete-all", requireAdmin, async (req, res) => {
    if (req.body?.confirm !== "ELIMINAR TODO") {
      return res.status(400).json({
        message: 'Confirmación requerida: enviar {"confirm":"ELIMINAR TODO"}',
      });
    }
    const scope = getScope(req);
    const deletedTasks = await storage.deleteAllActive(scope);

    if (deletedTasks.length > 0) {
      const batchId = randomUUID();
      await storage.createLogs(
        deletedTasks.map((t) => ({
          action: "DELETE_ALL",
          details: `Tarea #${t.id} eliminada en borrado masivo`,
          taskId: t.id,
          batchId,
          userId: scope.userId,
          originalValues: JSON.stringify({ status: "activa" }),
          newValues: JSON.stringify({ status: "eliminada" }),
          source: req.body?.source || "UI",
        })),
      );
    }

    res.json({ deleted: deletedTasks.length, ids: deletedTasks.map(t => t.id) });
  });

  // Import tasks (bulk create) — solo admin: puede setear person arbitrario
  // Antes admin-only. Un no-admin puede importar, pero solo para si mismo:
  // igual que en la creacion de una sola tarea, se ignora el campo person
  // del CSV y se fuerza su propio nombre + assignedUserId, para no poder
  // regalarle (ni robarle) tareas a otro por esta via. El admin mantiene
  // el comportamiento de siempre (persona libre, sin assignedUserId ->
  // bandeja "sin asignar").
  app.post("/api/tasks/import", requireAuth, writeRateLimit, async (req, res) => {
    try {
      const tasksData = req.body.tasks;
      if (!Array.isArray(tasksData) || tasksData.length === 0) {
        return res.status(400).json({ message: "No tasks provided" });
      }

      const scope = getScope(req);
      let selfAssign: { assignedUserId: number; person: string } | null = null;
      if (scope.role !== "admin") {
        const me = await storage.getUserById(scope.userId);
        selfAssign = {
          assignedUserId: scope.userId,
          person: me?.displayName || "a definir",
        };
      }

      const validTasks = tasksData.map((t: any) => ({
        text: t.text || "Sin título",
        date: t.date || "a definir",
        person: selfAssign ? selfAssign.person : t.person || "a definir",
        type: t.type || "a_definir",
        urgent: t.urgent || false,
        starred: t.starred || false,
        priority: t.priority || "normal",
        status: "activa",
        // Antes no se grababa: las tareas importadas por CSV quedaban sin
        // creador, invisibles en el filtro "Mías" de quien las importó.
        createdByUserId: scope.userId,
        ...(selfAssign ? { assignedUserId: selfAssign.assignedUserId } : {}),
      }));

      const created = await storage.importTasks(validTasks);

      if (created.length > 0) {
        const batchId = randomUUID();
        await storage.createLogs(
          created.map((t) => ({
            action: "IMPORT",
            details: `Tarea #${t.id} importada: "${t.text}"`,
            taskId: t.id,
            batchId,
            userId: scope.userId,
            newValues: JSON.stringify(t),
            source: "Import",
          })),
        );
      }

      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ---- LOGS ----

  // ── Medición de tiempo ──────────────────────────────────────────────

  // Qué está corriendo ahora. Sirve para restaurar el estado al abrir la app
  // en otro dispositivo: el cronómetro vive en la base, no en el navegador.
  app.get("/api/timer/current", requireAuth, async (req, res) => {
    const scope = getScope(req);
    const entry = await storage.getRunningEntry(scope.userId);
    res.json(entry ?? null);
  });

  app.post("/api/tasks/:id/timer/start", requireAuth, writeRateLimit, async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const scope = getScope(req);
    // Mismo criterio que el resto: 404 si no es visible para este usuario,
    // para no revelar la existencia de tareas ajenas. Los atajos de la barra
    // son la excepcion: no estan asignados a nadie (los comparte todo el
    // mundo), asi que se resuelven por su propia via en vez de ampliar el
    // scope general, que tambien habilitaria editarlos y borrarlos.
    const task = (await storage.getTaskForScope(id, scope))
      ?? (await storage.getQuickTaskById(id));
    if (!task) return res.status(404).json({ message: "Task not found" });

    const { started, stopped } = await storage.startTimer(id, scope.userId, req.body?.source || "UI");

    await storage.createLog({
      action: "TIMER_START",
      details: `Cronómetro iniciado en #${id}`,
      taskId: id,
      userId: scope.userId,
      source: req.body?.source || "UI",
    });

    res.json({ started, stopped: stopped ?? null });
  });

  app.post("/api/timer/stop", requireAuth, writeRateLimit, async (req, res) => {
    const scope = getScope(req);
    const stopped = await storage.stopTimer(scope.userId);
    if (!stopped) return res.json(null);

    const secs = stopped.endedAt
      ? Math.round((new Date(stopped.endedAt).getTime() - new Date(stopped.startedAt).getTime()) / 1000)
      : 0;

    await storage.createLog({
      action: "TIMER_STOP",
      details: `Cronómetro detenido en #${stopped.taskId} (${Math.round(secs / 60)} min)`,
      taskId: stopped.taskId,
      userId: scope.userId,
      source: req.body?.source || "UI",
    });

    res.json(stopped);
  });

  app.get("/api/tasks/:id/time-entries", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const scope = getScope(req);
    const task = await storage.getTaskForScope(id, scope);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(await storage.getEntriesForTask(id, scope.userId));
  });

  // Borrar una entrada mala (tipicamente una que cerro el corte automatico).
  // Sin esto, un dato erroneo queda para siempre torciendo los promedios.
  app.delete("/api/time-entries/:id", requireAuth, writeRateLimit, async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const scope = getScope(req);
    const ok = await storage.deleteTimeEntry(id, scope.userId);
    if (!ok) return res.status(404).json({ message: "Entry not found" });
    res.json({ deleted: true });
  });

  // Los tres atajos + cuanto lleva hoy el usuario en cada uno.
  app.get("/api/quick-tasks", requireAuth, async (req, res) => {
    const scope = getScope(req);
    const rawTz = typeof req.query.tz === "string" ? req.query.tz : "UTC";
    const tz = /^[A-Za-z_\/+-]{1,64}$/.test(rawTz) ? rawTz : "UTC";
    try {
      const [quick, totals] = await Promise.all([
        storage.getQuickTasks(),
        storage.getQuickTaskTotalsToday(scope.userId, tz),
      ]);
      res.json(quick.map((t) => ({
        id: t.id,
        text: t.text,
        quickSlot: t.quickSlot,
        todaySeconds: totals[t.id] ?? 0,
      })));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/time/summary", requireAuth, async (req, res) => {
    const scope = getScope(req);
    // La zona horaria la manda el cliente: los timestamps estan en UTC pero
    // "cuanto trabaje el martes" se agrupa por dia LOCAL.
    const rawTz = typeof req.query.tz === "string" ? req.query.tz : "UTC";
    const tz = /^[A-Za-z_\/+-]{1,64}$/.test(rawTz) ? rawTz : "UTC";
    const rawDays = parseInt(req.query.days as string);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;

    try {
      res.json(await storage.getTimeSummary(scope.userId, tz, days));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/logs", requireAuth, async (req, res) => {
    // Clamp: sin esto, ?limit=999999 traia la tabla de logs completa.
    const raw = parseInt(req.query.limit as string);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 1000) : 200;
    const logEntries = await storage.getLogs(limit, getScope(req));
    res.json(logEntries);
  });

  // ---- HEALTH ----

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ---- AI PARSE ----

  app.post("/api/parse", requireAuth, parseRateLimit, async (req, res) => {
    try {
      const { text, existingTaskIds } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }

      const today = format(new Date(), "dd/MM/yy");

      const response = await openai.chat.completions.create({
        // Se probo gpt-4.1-nano (un tercio mas barato) y NO sirve para esto:
        // no sigue de forma consistente las reglas condicionales de cuando
        // separar en varias tareas y cuando no — partia una sola idea en 2 o
        // 3 tareas sueltas. El ahorro era de centavos al mes; la diferencia
        // de calidad, notoria. Volver a nano solo si se rehace el prompt.
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

REGLAS IMPORTANTES:
1. POR DEFECTO TODO EL TEXTO ES **UNA SOLA TAREA**. Esta es la regla más importante de todas. Es mucho peor partir de más que de menos: si el usuario recibe 4 tareas sueltas cuando dictó una sola idea, tiene que borrarlas a mano una por una.
2. SOLO podés devolver más de una tarea si hay una señal EXPLÍCITA de separación en el texto. Las señales válidas son ÚNICAMENTE estas:
   (a) un PUNTO seguido de otra idea que tiene su propio verbo. Esta señal manda sobre la regla 1: si hay punto, SEPARÁ.
       "comprar pan. llamar al doctor" = DOS tareas ("comprar pan" / "llamar al doctor")
       "revisar las expensas. hablar con Marcos" = DOS tareas
   (b) que diga literalmente "punto", "nueva tarea", "otra tarea", "aparte", "por otro lado"
   (c) una numeración o viñetas ("1. ... 2. ...")
   (d) un salto de línea entre ideas
   Si NO hay ninguna de esas cuatro señales, devolvé UNA sola tarea con todo el texto.
3. Los conectores NO separan tareas. "y", "también", "además", "más", las comas y las enumeraciones son parte de LA MISMA tarea. Ejemplos que son UNA sola tarea:
   - "comprar pan y leche"
   - "poner en urgente lo de Martina y lo que falta de las expensas"
   - "revisar el informe, corregirlo y mandarlo"
4. Ante la MÍNIMA duda sobre si son una o varias: devolvé UNA SOLA.
5. El texto puede tener errores de dictado por voz, interpretá la intención.
6. Si menciona "urgente", "ya", "ahora", "prioridad", "asap" → marcar urgent: true
7. Limpiar el texto de la tarea: no incluir palabras como "agregar tarea", "anotar", etc. Solo la descripción de lo que hay que hacer. Pero NO resumas ni recortes el contenido: si la tarea tiene varias partes, conservalas todas en el texto.
8. Las fechas relativas como "mañana", "el lunes", "la semana que viene" deben convertirse al formato dd/mm/yy.
9. CRÍTICO — "update", "complete" y "delete" SOLO se pueden usar si podés indicar el "id" EXACTO de una tarea de la lista de IDs existentes. Si el usuario menciona una tarea por su texto pero NO sabés su id, NO uses "update": usá "create". Es preferible crear una tarea de más (que el usuario puede borrar) a descartar en silencio lo que pidió.
10. Ante la duda entre crear o modificar, SIEMPRE elegí "create".
11. Toda acción "update"/"complete"/"delete" DEBE incluir el campo "id" con un número de la lista de IDs existentes. Sin id, esa acción se descarta.
12. NUNCA asignes la tarea a una persona por más que el texto mencione un nombre (ej. "llamar a Marcos" NO asigna la tarea a Marcos, es solo parte de la descripción). La asignación de persona es siempre manual, hecha por el usuario en la interfaz — no es parte de tu trabajo.

IDs de tareas existentes: ${JSON.stringify(existingTaskIds || [])}

Responde SIEMPRE con un JSON con esta estructura:
{
  "actions": [
    {
      "action": "create",
      "text": "descripción limpia de la tarea",
      "date": "dd/mm/yy" o "a definir",
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
          // El asignado de persona es SIEMPRE manual (desde la UI, ver
          // task-card.tsx): aunque el modelo devuelva "person" por mencionar
          // un nombre en el texto, se ignora acá a propósito.
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
