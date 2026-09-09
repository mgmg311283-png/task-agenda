import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import type { QuickTaskIconName } from '@shared/schema';

export interface QuickTask {
  id: number;
  text: string;
  icon: QuickTaskIconName | null;
  quickSlot: number;
  /** Segundos de HOY ya cerrados. No incluye la sesion en curso: esa la suma
   *  el cliente con el cronometro en vivo, para no contarla dos veces. */
  todaySeconds: number;
}

/** Zona horaria del navegador: el total es "lo de hoy" en hora local, no UTC. */
function zonaHoraria(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function useQuickTasks() {
  const tz = zonaHoraria();
  return useQuery<QuickTask[]>({
    // La tz va en la key (y no solo en la URL) para que invalidar por
    // ['/api/quick-tasks'] siga matcheando por prefijo. El queryFn es
    // explicito porque el default arma la URL con queryKey.join('/'), que
    // convertiria la tz en segmentos de path.
    queryKey: ['/api/quick-tasks', tz],
    queryFn: async () => {
      const res = await fetch(`/api/quick-tasks?tz=${encodeURIComponent(tz)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    staleTime: 30_000,
  });
}

/** CRUD de los atajos en si (no del cronometro). Admin-only en el servidor. */
export function useQuickTaskAdmin() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/quick-tasks'] });

  const create = useMutation({
    mutationFn: async (input: { text: string; icon: QuickTaskIconName }) => {
      const res = await apiRequest('POST', '/api/quick-tasks', input);
      return res.json() as Promise<QuickTask>;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: number; text?: string; icon?: QuickTaskIconName }) => {
      const res = await apiRequest('PATCH', `/api/quick-tasks/${id}`, input);
      return res.json() as Promise<QuickTask>;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/quick-tasks/${id}`);
      return res.json() as Promise<QuickTask>;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate };
}
