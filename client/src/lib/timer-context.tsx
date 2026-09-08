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

interface TimerContextValue {
  running: TimeEntry | null;
  isBusy: boolean;
  toggle: (taskId: number) => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/**
 * Los segundos van en un contexto APARTE a propósito. Si vivieran en el mismo
 * que `running`, el valor del contexto cambiaría una vez por segundo y React
 * re-renderizaría TODAS las tarjetas que lo consumen cada segundo — anulando
 * el React.memo de TaskCard. Así, solo re-renderiza quien muestra el número.
 */
const ElapsedContext = createContext<number>(0);

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
  const { data: running = null } = useQuery<TimeEntry | null>({
    queryKey: ['/api/timer/current'],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const [elapsed, setElapsed] = useState(0);

  // Un solo intervalo para toda la app; el tiempo se calcula contra
  // startedAt del servidor, así no se desincroniza si la pestaña se congela.
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const tick = () => setElapsed(
      Math.max(0, Math.round((Date.now() - new Date(running.startedAt).getTime()) / 1000)),
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/timer/current'] });
    queryClient.invalidateQueries({ queryKey: ['/api/time/summary'] });
    // Refresca el total del dia de los atajos al parar/cambiar el cronometro.
    queryClient.invalidateQueries({ queryKey: ['/api/quick-tasks'] });
  }, [queryClient]);

  const startMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest('POST', `/api/tasks/${taskId}/timer/start`, { source: 'UI' });
      return res.json();
    },
    onSuccess: (r: any) => {
      if (r?.stopped) {
        toast({
          title: 'Cronómetro cambiado',
          description: `Pausé la tarea #${r.stopped.taskId} y arranqué la nueva.`,
        });
      }
      invalidate();
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/timer/stop', { source: 'UI' });
      return res.json();
    },
    onSuccess: (stopped: TimeEntry | null) => {
      if (stopped?.endedAt) {
        const secs = Math.round(
          (new Date(stopped.endedAt).getTime() - new Date(stopped.startedAt).getTime()) / 1000,
        );
        toast({ title: `Detenido: ${fmt(secs)}`, description: `Tarea #${stopped.taskId}` });
      }
      invalidate();
    },
  });

  const isBusy = startMutation.isPending || stopMutation.isPending;

  const toggle = useCallback(async (taskId: number) => {
    if (isBusy) return;
    if (running?.taskId === taskId) {
      await stopMutation.mutateAsync();
    } else {
      await startMutation.mutateAsync(taskId);
    }
  }, [isBusy, running, startMutation, stopMutation]);

  const value = React.useMemo(() => ({ running, isBusy, toggle }), [running, isBusy, toggle]);

  return (
    <TimerContext.Provider value={value}>
      <ElapsedContext.Provider value={elapsed}>
        {children}
      </ElapsedContext.Provider>
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}

export function useElapsed() {
  return useContext(ElapsedContext);
}

/** Muestra el tiempo en curso. Aislado para que el tick de 1s re-renderice
 *  solo este span y no la tarjeta entera. */
export function ElapsedLabel({ className }: { className?: string }) {
  const elapsed = useElapsed();
  return <span className={className}>{fmt(elapsed)}</span>;
}
