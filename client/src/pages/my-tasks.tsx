import { useState, useMemo } from "react";
import { useTasks } from "@/lib/task-context";
import { useAuth } from "@/lib/auth-context";
import { Task } from "@/lib/types";
import { parseDateStr, formatDate, advanceDays, isOverdue, isToday } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, LogOut, Plus, Clock, History } from "lucide-react";
import { TaskHistoryDialog } from "@/components/task-history-dialog";

/** Agrupa en Vencidas / Hoy / Proximas / Sin fecha. */
function group(tasks: Task[]) {
  const vencidas: Task[] = [];
  const hoy: Task[] = [];
  const proximas: Task[] = [];
  const sinFecha: Task[] = [];

  for (const t of tasks) {
    if (!t.date || t.date === "a definir") sinFecha.push(t);
    else if (isToday(t.date)) hoy.push(t);
    else if (isOverdue(t.date)) vencidas.push(t);
    else proximas.push(t);
  }

  const byDate = (a: Task, b: Task) => {
    const da = parseDateStr(a.date)?.getTime() ?? 0;
    const db = parseDateStr(b.date)?.getTime() ?? 0;
    return da - db;
  };
  vencidas.sort(byDate);
  hoy.sort(byDate);
  proximas.sort(byDate);

  return { vencidas, hoy, proximas, sinFecha };
}

function TaskRow({
  task,
  onComplete,
  onPostpone,
  onHistory,
}: {
  task: Task;
  onComplete: (id: number) => void;
  onPostpone: (task: Task, days: number) => void;
  onHistory: (id: number) => void;
}) {
  return (
    <div
      className="border border-border rounded-md p-3 bg-card space-y-3"
      data-testid={`card-mytask-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <span className="font-mono text-xs text-muted-foreground shrink-0 pt-0.5">
          #{task.id}
        </span>
        <p className="text-sm flex-1 break-words">{task.text}</p>
        {task.urgent && (
          <span className="text-[10px] font-bold text-destructive shrink-0">URGENTE</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-muted-foreground">
          {task.date === "a definir" ? "sin fecha" : task.date}
        </span>

        {/* Acciones grandes: minimo 44px de alto para dedo en celular */}
        <Button
          size="sm"
          className="h-11 px-4 gap-1.5 ml-auto"
          onClick={() => onComplete(task.id)}
          data-testid={`button-complete-${task.id}`}
        >
          <Check className="w-4 h-4" />
          Listo
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-11 px-3 gap-1"
          onClick={() => onPostpone(task, 1)}
          data-testid={`button-plus1d-${task.id}`}
        >
          <ChevronRight className="w-3 h-3" />
          1d
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-11 px-3 gap-1"
          onClick={() => onPostpone(task, 7)}
          data-testid={`button-plus7d-${task.id}`}
        >
          <ChevronRight className="w-3 h-3" />
          7d
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-11 w-11 p-0"
          onClick={() => onHistory(task.id)}
          title="Ver historial"
          data-testid={`button-history-${task.id}`}
        >
          <History className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  tasks,
  tone,
  ...handlers
}: {
  title: string;
  tasks: Task[];
  tone?: "danger" | "normal";
  onComplete: (id: number) => void;
  onPostpone: (task: Task, days: number) => void;
  onHistory: (id: number) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2
        className={`text-xs font-bold tracking-wider ${
          tone === "danger" ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {title} ({tasks.length})
      </h2>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} {...handlers} />
        ))}
      </div>
    </section>
  );
}

export function MyTasks() {
  const { state, dispatch } = useTasks();
  const { user, logout } = useAuth();
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);

  // El servidor ya devuelve solo las tareas que este usuario puede ver.
  const active = useMemo(
    () => state.tasks.filter((t) => t.status === "activa"),
    [state.tasks],
  );
  const { vencidas, hoy, proximas, sinFecha } = useMemo(() => group(active), [active]);

  const onComplete = (id: number) =>
    dispatch({ type: "COMPLETE_TASK", payload: { id }, source: "UI" });

  const onPostpone = (task: Task, days: number) =>
    dispatch({
      type: "UPDATE_TASK",
      payload: { id: task.id, updates: { date: advanceDays(task.date, days) } },
      source: "UI",
    });

  const handleAdd = () => {
    const text = newText.trim();
    if (!text) return;
    dispatch({
      type: "ADD_TASK",
      payload: { text, date: formatDate(new Date()), type: "accion" },
      source: "UI",
    });
    setNewText("");
    setAdding(false);
  };

  const total = active.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{user?.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? "tarea pendiente" : "tareas pendientes"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0"
          onClick={logout}
          title="Salir"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      <main className="flex-1 px-4 py-4 space-y-5 pb-24">
        {state.isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
        )}

        {!state.isLoading && total === 0 && (
          <div className="text-center py-16 space-y-1">
            <Clock className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tenés tareas pendientes</p>
          </div>
        )}

        <Section title="VENCIDAS" tasks={vencidas} tone="danger"
          onComplete={onComplete} onPostpone={onPostpone} onHistory={setHistoryId} />
        <Section title="HOY" tasks={hoy}
          onComplete={onComplete} onPostpone={onPostpone} onHistory={setHistoryId} />
        <Section title="PRÓXIMAS" tasks={proximas}
          onComplete={onComplete} onPostpone={onPostpone} onHistory={setHistoryId} />
        <Section title="SIN FECHA" tasks={sinFecha}
          onComplete={onComplete} onPostpone={onPostpone} onHistory={setHistoryId} />
      </main>

      {/* Alta rapida */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3">
        {adding ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewText(""); }
              }}
              placeholder="¿Qué hay que hacer?"
              className="flex-1 h-11 px-3 rounded-md border border-input bg-background text-sm"
              data-testid="input-new-task"
            />
            <Button className="h-11" onClick={handleAdd} data-testid="button-save-task">
              Guardar
            </Button>
          </div>
        ) : (
          <Button
            className="w-full h-12 gap-2"
            onClick={() => setAdding(true)}
            data-testid="button-new-task"
          >
            <Plus className="w-4 h-4" />
            Nueva tarea
          </Button>
        )}
      </div>

      {historyId !== null && (
        <TaskHistoryDialog taskId={historyId} onClose={() => setHistoryId(null)} />
      )}
    </div>
  );
}
