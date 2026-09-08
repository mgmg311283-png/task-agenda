import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Summary {
  byDay: { day: string; seconds: string | number }[];
  byTask: { task_id: number; text: string; seconds: string | number; sessions: number }[];
  suspicious: { id: number; task_id: number; text: string; started_at: string; ended_at: string }[];
}

const hhmm = (raw: string | number) => {
  const s = Number(raw) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export function TimeReport() {
  const queryClient = useQueryClient();
  // La zona horaria la decide el navegador: el servidor guarda UTC, pero
  // "cuánto trabajé el martes" tiene que agruparse por día local.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const { data, isLoading } = useQuery<Summary>({
    queryKey: [`/api/time/summary?tz=${encodeURIComponent(tz)}&days=30`],
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/time-entries/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Entrada borrada" });
      queryClient.invalidateQueries({ queryKey: [`/api/time/summary?tz=${encodeURIComponent(tz)}&days=30`] });
    },
  });

  if (isLoading) {
    return <p className="text-sm font-mono text-muted-foreground">Cargando tiempos...</p>;
  }

  const byDay = data?.byDay ?? [];
  const byTask = data?.byTask ?? [];
  const suspicious = data?.suspicious ?? [];
  const total = byDay.reduce((acc, d) => acc + (Number(d.seconds) || 0), 0);

  if (byDay.length === 0 && byTask.length === 0) {
    return (
      <div className="border border-dashed border-border p-6 text-center">
        <p className="text-sm font-mono text-muted-foreground">Todavía no mediste tiempo.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Tocá ▶ en una tarea para empezar a medir.
        </p>
      </div>
    );
  }

  const max = Math.max(...byTask.map(t => Number(t.seconds) || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold font-mono uppercase mb-1">Últimos 30 días</h3>
        <p className="text-2xl font-bold tabular-nums">{hhmm(total)}</p>
        <p className="text-xs text-muted-foreground">
          repartidos en {byDay.length} día{byDay.length === 1 ? "" : "s"} con actividad
        </p>
      </div>

      <div>
        <h3 className="text-sm font-bold font-mono uppercase mb-2">En qué se fue el tiempo</h3>
        <div className="space-y-1.5">
          {byTask.map(t => (
            <div key={t.task_id} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate" title={t.text}>#{t.task_id} {t.text}</span>
                <span className="font-mono tabular-nums shrink-0">
                  {hhmm(t.seconds)}
                  {t.sessions > 1 && (
                    <span className="text-muted-foreground/60 ml-1">({t.sessions}x)</span>
                  )}
                </span>
              </div>
              <div className="h-1 bg-muted mt-0.5">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${((Number(t.seconds) || 0) / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {suspicious.length > 0 && (
        <div>
          <h3 className="text-sm font-bold font-mono uppercase mb-1 text-orange-600">
            Revisar ({suspicious.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            El cronómetro quedó corriendo y se cortó solo a las 8 horas. Si el
            dato está mal, borralo para que no tuerza los promedios.
          </p>
          <div className="space-y-1">
            {suspicious.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-xs border border-orange-200 dark:border-orange-900 px-2 py-1">
                <span className="truncate">
                  #{e.task_id} {e.text}
                  <span className="text-muted-foreground ml-1">
                    ({new Date(e.started_at).toLocaleDateString()})
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 hover:text-red-600"
                  onClick={() => del.mutate(e.id)}
                  disabled={del.isPending}
                  title="Borrar esta entrada"
                  aria-label={`Borrar la entrada de tiempo de la tarea ${e.task_id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
