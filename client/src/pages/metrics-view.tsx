import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useTasks } from "@/lib/task-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isTaskOverdue } from "@/lib/parser";
import { useMemo } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

function parseUpdatedAt(str: string): Date {
  try { return new Date(str); } catch { return new Date(0); }
}

export function MetricsView() {
  const { state } = useTasks();
  const allTasks = state.allTasks || state.tasks;
  const activeTasks = allTasks.filter(t => t.status === 'activa');
  const completedTasks = allTasks.filter(t => t.status === 'completada');
  const deletedTasks = allTasks.filter(t => t.status === 'eliminada');
  const overdueTasks = activeTasks.filter(t => isTaskOverdue(t.date));

  const completionRate = allTasks.length > 0
    ? Math.round((completedTasks.length / allTasks.length) * 100)
    : 0;

  // Completed per day (last 14 days)
  const completedByDay = useMemo(() => {
    const days: { date: string; completadas: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayStr = format(day, 'dd/MM');
      const dayFull = format(day, 'yyyy-MM-dd');
      const count = completedTasks.filter(t => t.updatedAt?.startsWith(dayFull)).length;
      days.push({ date: dayStr, completadas: count });
    }
    return days;
  }, [completedTasks]);

  // Tasks by person
  const byPerson = useMemo(() => {
    const map: Record<string, number> = {};
    activeTasks.forEach(t => {
      const p = t.person || 'a definir';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [activeTasks]);

  // Tasks by type
  const byType = useMemo(() => {
    const map: Record<string, number> = { accion: 0, para_pensar: 0, a_definir: 0 };
    activeTasks.forEach(t => { map[t.type] = (map[t.type] || 0) + 1; });
    return [
      { name: 'Acción', value: map.accion, fill: '#3b82f6' },
      { name: 'Pensar', value: map.para_pensar, fill: '#eab308' },
      { name: 'A definir', value: map.a_definir, fill: '#9ca3af' },
    ].filter(d => d.value > 0);
  }, [activeTasks]);

  // Tasks completed by source (from logs)
  const bySource = useMemo(() => {
    const map: Record<string, number> = {};
    state.logs.filter(l => l.action === 'COMPLETE').forEach(l => {
      map[l.source] = (map[l.source] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [state.logs]);

  const COLORS = ['#3b82f6', '#ef4444', '#eab308', '#10b981', '#8b5cf6', '#f97316'];

  return (
    <div className="min-h-screen bg-muted/30 p-4 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold font-mono">MÉTRICAS Y REPORTES</h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Activas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold font-mono">{activeTasks.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Completadas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold font-mono text-green-600">{completedTasks.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Eliminadas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold font-mono text-red-600">{deletedTasks.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Vencidas</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold font-mono text-orange-600">{overdueTasks.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Completación</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold font-mono text-blue-600">{completionRate}%</div></CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Completadas por día */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Completadas — últimos 14 días</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={completedByDay} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace' }} interval={2} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'monospace' }} />
                  <Bar dataKey="completadas" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Por persona */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Activas por persona</CardTitle></CardHeader>
            <CardContent>
              {byPerson.length === 0 ? (
                <p className="text-xs text-muted-foreground font-mono">Sin datos</p>
              ) : (
                <ul className="space-y-2">
                  {byPerson.map(({ name, value }) => (
                    <li key={name} className="flex items-center gap-2">
                      <span className="font-mono text-xs w-24 truncate text-muted-foreground">{name}</span>
                      <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(value / activeTasks.length) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold w-6 text-right">{value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Por tipo */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Activas por tipo</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              {byType.length === 0 ? (
                <p className="text-xs text-muted-foreground font-mono">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {byType.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'monospace' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top urgentes */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Urgentes Pendientes</CardTitle></CardHeader>
            <CardContent>
              {activeTasks.filter(t => t.urgent).length === 0 ? (
                <p className="text-xs text-muted-foreground font-mono">Sin urgentes</p>
              ) : (
                <ul className="space-y-2">
                  {activeTasks.filter(t => t.urgent).slice(0, 6).map(t => (
                    <li key={t.id} className="flex justify-between items-center text-sm border-b pb-1 gap-2">
                      <span className="truncate">{t.text}</span>
                      <span className="font-mono text-xs text-red-500 shrink-0">#{t.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Por fuente de completación */}
        {bySource.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-sm">Tareas completadas por fuente</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap">
                {bySource.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center gap-2 text-sm font-mono">
                    <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {name}: <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
