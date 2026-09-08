import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TaskProvider } from "@/lib/task-context";
import { TimerProvider } from "@/lib/timer-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Dashboard } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import NotFound from "@/pages/not-found";

// El tablero y el login se cargan siempre; log, metricas y usuarios son
// pantallas secundarias (y traen recharts, que es pesado). Cargarlas aparte
// baja el bundle inicial, que era un unico archivo de ~1MB.
const LogView = lazy(() => import("@/pages/log-view").then(m => ({ default: m.LogView })));
const MetricsView = lazy(() => import("@/pages/metrics-view").then(m => ({ default: m.MetricsView })));
const UsersView = lazy(() => import("@/pages/users-view").then(m => ({ default: m.UsersView })));
import { ErrorBoundary } from "@/components/error-boundary";

// Un solo tablero para todos los roles: el servidor ya filtra que cada uno
// vea solo lo suyo (o lo de su equipo, si es supervisor), así que no hace
// falta una UI distinta — TopBar oculta las acciones de administrador
// (import, borrado masivo, usuarios) para quien no sea admin.
function Router() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground font-mono">Cargando...</p>
      </div>
    }>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/log" component={LogView} />
        <Route path="/metrics" component={MetricsView} />
        <Route path="/usuarios" component={UsersView} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // TaskProvider se monta DESPUES del login a proposito: arranca a pollear
  // /api/tasks, /api/tasks/all y /api/logs al montarse, y si estuviera por
  // fuera del gate esas queries darian 401 en loop en la pantalla de login.
  return (
    <TaskProvider>
      <TimerProvider>
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
        <Toaster />
      </TimerProvider>
    </TaskProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
