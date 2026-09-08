import { useQuery } from '@tanstack/react-query';

export interface QuickTask {
  id: number;
  text: string;
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
