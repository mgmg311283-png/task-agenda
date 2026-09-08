import React from 'react';
import { Mail, MessageCircle, Zap, Play, Square } from 'lucide-react';
import { useTimer, useElapsed, formatElapsed } from '@/lib/timer-context';
import { useQuickTasks, type QuickTask } from '@/lib/quick-tasks';
import { cn } from '@/lib/utils';

// Por posicion del atajo (quick_slot). Si algun dia se agrega un cuarto,
// cae en el icono generico en vez de romper.
const ICONOS = [Mail, MessageCircle, Zap];

/**
 * Total del dia para UN atajo. Aislado en su propio componente a proposito:
 * useElapsed cambia una vez por segundo, y si se leyera en la barra entera
 * los tres botones se re-renderizarian cada segundo. Asi solo late el numero
 * del que esta corriendo.
 */
function TotalDeHoy({ base, corriendo }: { base: number; corriendo: boolean }) {
  const elapsed = useElapsed();
  return (
    <span className="tabular-nums">
      {formatElapsed(base + (corriendo ? elapsed : 0))}
    </span>
  );
}

function BotonAtajo({ tarea, indice }: { tarea: QuickTask; indice: number }) {
  const { running, isBusy, toggle } = useTimer();
  const corriendo = running?.taskId === tarea.id;
  const Icono = ICONOS[indice] ?? Zap;

  return (
    <button
      type="button"
      onClick={() => toggle(tarea.id)}
      disabled={isBusy}
      aria-pressed={corriendo}
      title={corriendo ? `Detener: ${tarea.text}` : `Empezar: ${tarea.text}`}
      data-testid={`btn-atajo-${tarea.quickSlot}`}
      className={cn(
        'flex items-center gap-2 shrink-0 px-2.5 py-1 border text-[11px] font-mono uppercase tracking-wide',
        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        corriendo
          ? 'border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
    >
      {corriendo
        ? <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
        : <Icono className="w-3.5 h-3.5 shrink-0 opacity-70" />}
      <span className="truncate max-w-[130px]">{tarea.text}</span>
      <span className={cn('shrink-0 font-bold', !corriendo && 'text-muted-foreground')}>
        <TotalDeHoy base={tarea.todaySeconds} corriendo={corriendo} />
      </span>
      {corriendo
        ? <Square className="w-3 h-3 shrink-0" />
        : <Play className="w-3 h-3 shrink-0 opacity-50" />}
    </button>
  );
}

/**
 * Atajos para las tareas recurrentes que se comen el dia (mails, WhatsApp,
 * interrupciones). Un click arranca el cronometro, otro lo para, y arrancar
 * uno detiene el anterior — eso ultimo ya lo garantiza el servidor, que
 * permite una sola entrada abierta por usuario.
 */
export function QuickTaskBar() {
  const { data: atajos = [], isError } = useQuickTasks();
  if (isError || atajos.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background overflow-x-auto shrink-0"
      data-testid="barra-atajos"
    >
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">
        Rápido:
      </span>
      {atajos.map((t, i) => (
        <BotonAtajo key={t.id} tarea={t} indice={i} />
      ))}
      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-auto pl-2 hidden sm:inline">
        hoy
      </span>
    </div>
  );
}
