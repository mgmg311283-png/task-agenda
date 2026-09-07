import { QueryClient, QueryFunction, MutationCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getApiUrl(path: string): string {
  // La API y el cliente se sirven desde el mismo proceso/origen (puerto 5000).
  // Usar rutas relativas al mismo origen.
  return path;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = getApiUrl(url);
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    const fullUrl = getApiUrl(path);
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Antes, si una escritura fallaba (sesion vencida, permiso denegado, caida de
 * red, error del servidor) no pasaba absolutamente nada visible: la mutacion
 * quedaba en error, nadie lo miraba, y el proximo refetch de 5s devolvia el
 * valor viejo. El usuario veia que "no guardo" sin saber por que.
 *
 * Este handler global avisa por toast ante cualquier mutacion fallida. Una
 * mutacion que ya muestra su propio mensaje puede optar por salirse con
 * `meta: { skipGlobalError: true }`.
 */
const mutationCache = new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    if (mutation.meta?.skipGlobalError) return;

    const raw = error instanceof Error ? error.message : String(error);
    const isAuth = /^(401|403)/.test(raw);

    toast({
      title: isAuth ? "Sesión vencida o sin permiso" : "No se pudo guardar el cambio",
      description: isAuth
        ? "Volvé a iniciar sesión para seguir editando."
        : raw.slice(0, 200),
      variant: "destructive",
    });
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: true,
      staleTime: 2000,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
