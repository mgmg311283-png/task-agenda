import React, { createContext, useContext, useCallback, ReactNode, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import { toast } from '@/hooks/use-toast';

export interface TimeEntry {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string;
  endedAt: string | null;
  autoClosed: boolean;
  source: string;
}

/** Tiene que coincidir con MAX_RUNNING_TIMERS del servidor, que es quien manda. */
export const MAX_RUNNING_TIMERS = 3;

interface TimerContextValue {
  /** Lo que esta corriendo ahora, del mas viejo al mas nuevo (hasta 3). */
  running: TimeEntry[];
  isBusy: boolean;
  /** La entrada abierta de esa tarea, o null si no esta corriendo. */
  entryFor: (taskId: number) => TimeEntry | null;
  isRunning: (taskId: number) => boolean;
  /** Arranca o para esa tarea. No toca las otras. */
  toggle: (taskId: number) => Promise<void>;
  /** Para las tres (o las que haya) de una sola vez. */
  stopAll: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/**
 * El "ahora" en milisegundos, actualizado una vez por segundo, va en un
 * contexto APARTE a proposito. Si viviera en el mismo que `running`, el valor
 * del contexto cambiaria cada segundo y React re-renderizaria TODAS las
 * tarjetas que lo consumen — anulando el React.memo de TaskCard. Asi solo
 * re-renderiza quien muestra un numero.
 *
 * Antes esto guardaba los segundos del unico cronometro posible; con varios
 * en paralelo cada uno calcula los suyos contra su propio startedAt.
 */
const NowContext = createContext<number>(Date.now());

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

export const formatElapsed = fmt;

export function TimerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // El cronómetro vive en el servidor, no en el navegador: si arrancás una
  // tarea en el celular y abrís la compu, tiene que aparecer corriendo ahí.
  const { data: running = [] } = useQuery<TimeEntry[]>({
    queryKey: ['/api/timer/running'],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const [now, setNow] = useState(() => Date.now());
  const hayAlguno = running.length > 0;

  // Un solo intervalo para toda la app; cada label calcula su tiempo contra el
  // startedAt del servidor, así no se desincroniza si la pestaña se congela.
  useEffect(() => {
    if (!hayAlguno) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hayAlguno]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/timer/running'] });
    queryClient.invalidateQueries({ queryKey: ['/api/time/summary'] });
    // Refresca el total del dia de los atajos al parar/cambiar el cronometro.
    queryClient.invalidateQueries({ queryKey: ['/api/quick-tasks'] });
  }, [queryClient]);

  const startMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest('POST', `/api/tasks/${taskId}/timer/start`, { source: 'UI' });
      return res.json();
    },
    // El 409 del tope de 3 no es un error que haya que gritar: se avisa abajo
    // con un mensaje entendible en vez del toast generico de mutaciones.
    meta: { skipGlobalError: true },
    onSuccess: invalidate,
    onError: (err: Error) => {
      const tope = err.message.includes('409');
      toast({
        variant: tope ? 'default' : 'destructive',
        title: tope ? `Máximo ${MAX_RUNNING_TIMERS} tareas a la vez` : 'No se pudo arrancar el cronómetro',
        description: tope
          ? 'Pará alguna de las que están corriendo para arrancar esta.'
          : err.message,
      });
      invalidate();
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (taskId?: number) => {
      const res = await apiRequest('POST', '/api/timer/stop', { source: 'UI', taskId });
      return res.json() as Promise<{ stopped: TimeEntry[] }>;
    },
    meta: { skipGlobalError: true },
    onSuccess: ({ stopped }) => {
      if (stopped?.length === 1) {
        const e = stopped[0];
        const secs = e.endedAt
          ? Math.round((new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 1000)
          : 0;
        toast({ title: `Detenido: ${fmt(secs)}`, description: `Tarea #${e.taskId}` });
      } else if (stopped?.length > 1) {
        toast({ title: `${stopped.length} cronómetros detenidos` });
      }
      invalidate();
    },
  });

  const isBusy = startMutation.isPending || stopMutation.isPending;

  const entryFor = useCallback(
    (taskId: number) => running.find(e => e.taskId === taskId) ?? null,
    [running],
  );

  const isRunning = useCallback((taskId: number) => !!entryFor(taskId), [entryFor]);

  const toggle = useCallback(async (taskId: number) => {
    if (isBusy) return;
    if (isRunning(taskId)) {
      await stopMutation.mutateAsync(taskId);
    } else {
      await startMutation.mutateAsync(taskId);
    }
  }, [isBusy, isRunning, startMutation, stopMutation]);

  const stopAll = useCallback(async () => {
    if (isBusy || running.length === 0) return;
    await stopMutation.mutateAsync(undefined);
  }, [isBusy, running.length, stopMutation]);

  const value = React.useMemo(
    () => ({ running, isBusy, entryFor, isRunning, toggle, stopAll }),
    [running, isBusy, entryFor, isRunning, toggle, stopAll],
  );

  return (
    <TimerContext.Provider value={value}>
      <NowContext.Provider value={now}>
        {children}
      </NowContext.Provider>
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}

/** Segundos corridos de una entrada. `null` (nada corriendo) devuelve 0. */
export function useElapsed(startedAt?: string | null) {
  const now = useContext(NowContext);
  if (!startedAt) return 0;
  return Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
}

/** Muestra el tiempo en curso. Aislado para que el tick de 1s re-renderice
 *  solo este span y no la tarjeta entera. */
export function ElapsedLabel({ startedAt, className }: { startedAt?: string | null; className?: string }) {
  const elapsed = useElapsed(startedAt);
  return <span className={className}>{fmt(elapsed)}</span>;
}
