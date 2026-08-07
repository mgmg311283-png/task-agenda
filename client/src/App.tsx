import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TaskProvider } from "@/lib/task-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Dashboard } from "@/pages/dashboard";
import { LogView } from "@/pages/log-view";
import { MetricsView } from "@/pages/metrics-view";
import { MyTasks } from "@/pages/my-tasks";
import { LoginPage } from "@/pages/login";
import { UsersView } from "@/pages/users-view";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/error-boundary";

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/log" component={LogView} />
      <Route path="/metrics" component={MetricsView} />
      <Route path="/usuarios" component={UsersView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function OperarioRouter() {
  // Vista simplificada: sin kanban, sin metricas, sin import/export.
  return (
    <Switch>
      <Route path="/" component={MyTasks} />
      <Route component={MyTasks} />
    </Switch>
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
      <ErrorBoundary>
        {user.role === "admin" ? <AdminRouter /> : <OperarioRouter />}
      </ErrorBoundary>
      <Toaster />
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
