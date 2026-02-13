import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TaskProvider } from "@/lib/task-context";
import { Dashboard } from "@/pages/dashboard";
import { LogView } from "@/pages/log-view";
import { MetricsView } from "@/pages/metrics-view";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/log" component={LogView} />
      <Route path="/metrics" component={MetricsView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TaskProvider>
        <Router />
        <Toaster />
      </TaskProvider>
    </QueryClientProvider>
  );
}

export default App;
