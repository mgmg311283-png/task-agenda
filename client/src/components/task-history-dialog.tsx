import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface HistoryChange {
  field: string;
  from: unknown;
  to: unknown;
  label: string;
}

interface HistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  actionLabel: string;
  details: string;
  source: string;
  batchId: string | null;
  user: { id: number; name: string | null } | null;
  changes: HistoryChange[];
}

interface HistoryResponse {
  task: { id: number; text: string };
  events: HistoryEvent[];
}

function fmt(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function TaskHistoryDialog({
  taskId,
  onClose,
}: {
  taskId: number;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: [`/api/tasks/${taskId}/history`],
    staleTime: 0,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-history">
        <DialogHeader>
          <DialogTitle className="text-base">
            Historial de la tarea #{taskId}
          </DialogTitle>
        </DialogHeader>

        {data?.task?.text && (
          <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
            {data.task.text}
          </p>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {error && <p className="text-sm text-destructive">No se pudo cargar el historial.</p>}

        {data && data.events.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
        )}

        <ol className="space-y-3">
          {data?.events?.map((ev) => (
            <li
              key={ev.id}
              className="border-l-2 border-border pl-3 pb-1 space-y-1"
              data-testid={`history-event-${ev.id}`}
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold">{ev.actionLabel}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {fmt(ev.timestamp)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {ev.user?.name
                    ? `por ${ev.user.name}`
                    : /* Los logs previos al login no tienen autor. Se dice, en
                         vez de atribuirselos a alguien. */
                      "(antes del login)"}
                </span>
                {ev.batchId && (
                  <span className="text-[10px] text-muted-foreground border border-border rounded px-1">
                    acción masiva
                  </span>
                )}
              </div>

              {ev.changes.length > 0 ? (
                <ul className="space-y-0.5">
                  {ev.changes.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      • {c.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{ev.details}</p>
              )}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
