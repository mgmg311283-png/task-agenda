import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useTasks } from "@/lib/task-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isTaskOverdue } from "@/lib/parser";

export function MetricsView() {
  const { state } = useTasks();
  const allTasks = state.allTasks || state.tasks;
  const activeTasks = allTasks.filter(t => t.status === 'activa');
  const completedTasks = allTasks.filter(t => t.status === 'completada');
  const deletedTasks = allTasks.filter(t => t.status === 'eliminada');
  const overdueTasks = activeTasks.filter(t => isTaskOverdue(t.date));

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
       <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
            <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 bg-white">
                <ChevronLeft className="h-4 w-4" /> Volver al Tablero
            </Button>
            </Link>
            <h1 className="text-2xl font-bold">Métricas y Reportes</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Activas</CardTitle></CardHeader>
                <CardContent><div className="text-4xl font-bold font-mono">{activeTasks.length}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Completadas</CardTitle></CardHeader>
                <CardContent><div className="text-4xl font-bold font-mono text-green-600">{completedTasks.length}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Eliminadas</CardTitle></CardHeader>
                <CardContent><div className="text-4xl font-bold font-mono text-red-600">{deletedTasks.length}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Vencidas</CardTitle></CardHeader>
                <CardContent><div className="text-4xl font-bold font-mono text-orange-600">{overdueTasks.length}</div></CardContent>
            </Card>
        </div>

        {/* Charts or detailed lists could go here */}
        <div className="grid md:grid-cols-2 gap-8">
            <Card>
                <CardHeader><CardTitle>Top Pendientes Urgentes</CardTitle></CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        {activeTasks.filter(t => t.urgent).slice(0, 5).map(t => (
                            <li key={t.id} className="flex justify-between items-center text-sm border-b pb-1">
                                <span>{t.text}</span>
                                <span className="font-mono text-xs text-red-500">#{t.id}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
