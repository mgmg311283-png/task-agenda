import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Search, X, RotateCcw } from "lucide-react";
import { useTasks } from "@/lib/task-context";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Task } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

const REVERTIBLE_ACTIONS = ['CREATE', 'UPDATE', 'COMPLETE', 'DELETE'];
const TASK_FIELDS: (keyof Task)[] = ['text', 'date', 'person', 'type', 'urgent', 'status', 'starred', 'priority'];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300',
  UPDATE: 'text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300',
  COMPLETE: 'text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300',
  DELETE: 'text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300',
  DELETE_ALL: 'text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300',
  IMPORT: 'text-orange-700 bg-orange-50 dark:bg-orange-950 dark:text-orange-300',
  MOVE_EXPIRED: 'text-yellow-700 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300',
};

const ALL_ACTIONS = ['CREATE', 'UPDATE', 'COMPLETE', 'DELETE', 'IMPORT', 'MOVE_EXPIRED'];
const ALL_SOURCES = ['UI', 'Chat', 'Audio', 'Import'];

export function LogView() {
  const { state, dispatch } = useTasks();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return state.logs.filter(log => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (sourceFilter && log.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return log.details.toLowerCase().includes(q) || String(log.taskId).includes(q);
      }
      return true;
    });
  }, [state.logs, actionFilter, sourceFilter, search]);

  const hasFilters = actionFilter || sourceFilter || search;

  const handleRevert = (log: (typeof state.logs)[number], originalVals: any) => {
    if (!log.taskId) return;
    if (!confirm(`¿Revertir este cambio en la tarea #${log.taskId}?`)) return;

    if (log.action === 'CREATE') {
      dispatch({ type: 'UPDATE_TASK', payload: { id: log.taskId, updates: { status: 'eliminada' } }, source: 'UI' });
    } else if (originalVals) {
      const updates: Partial<Task> = {};
      TASK_FIELDS.forEach(f => {
        if (f in originalVals) (updates as any)[f] = originalVals[f];
      });
      dispatch({ type: 'UPDATE_TASK', payload: { id: log.taskId, updates }, source: 'UI' });
    }
    toast({ title: "Revertido", description: `Tarea #${log.taskId} restaurada a su estado anterior.` });
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6 border-b pb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>
        <h1 className="text-xl font-bold font-mono">HISTORIAL DE CAMBIOS</h1>
        <span className="text-xs font-mono text-muted-foreground ml-auto">{filtered.length} registros</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-7 pr-3 py-1.5 text-xs font-mono border border-border bg-background focus:border-foreground focus:outline-none"
          />
        </div>

        {/* Action filter */}
        <div className="flex gap-1 flex-wrap">
          {ALL_ACTIONS.map(action => (
            <button
              key={action}
              onClick={() => setActionFilter(actionFilter === action ? '' : action)}
              className={cn(
                "text-[10px] font-mono px-2 py-1 border transition-colors",
                actionFilter === action
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
            >
              {action}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div className="flex gap-1">
          {ALL_SOURCES.map(source => (
            <button
              key={source}
              onClick={() => setSourceFilter(sourceFilter === source ? '' : source)}
              className={cn(
                "text-[10px] font-mono px-2 py-1 border transition-colors",
                sourceFilter === source
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
            >
              {source}
            </button>
          ))}
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setActionFilter(''); setSourceFilter(''); setSearch(''); }}
          >
            <X className="w-3 h-3 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Log entries */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground font-mono text-sm py-8 text-center">
            {hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay registros aún.'}
          </p>
        ) : (
          filtered.map((log) => {
            const actionColor = ACTION_COLORS[log.action] || 'text-muted-foreground bg-muted';
            const isExpanded = expandedId === log.id;

            let originalVals: any = null;
            let newVals: any = null;
            try { if (log.originalValues) originalVals = JSON.parse(log.originalValues); } catch {}
            try { if (log.newValues) newVals = JSON.parse(log.newValues); } catch {}

            const canRevert = !!log.taskId && REVERTIBLE_ACTIONS.includes(log.action) && (log.action === 'CREATE' || !!originalVals);

            return (
              <div
                key={log.id}
                className="border border-border bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <div className="flex gap-2 items-center px-3 py-2 text-xs font-mono">
                  <span className="text-muted-foreground shrink-0 w-32">
                    {format(new Date(log.timestamp), "dd/MM/yy HH:mm:ss")}
                  </span>
                  <span className={cn("px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0", actionColor)}>
                    {log.action}
                  </span>
                  <span className="text-muted-foreground shrink-0 border border-border px-1">
                    {log.source}
                  </span>
                  <span className="flex-1 truncate text-foreground">{log.details}</span>
                  {log.taskId ? (
                    <span className="text-muted-foreground shrink-0">#{log.taskId}</span>
                  ) : null}
                  {canRevert && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      title="Revertir este cambio"
                      onClick={(e) => { e.stopPropagation(); handleRevert(log, originalVals); }}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {isExpanded && (originalVals || newVals) && (
                  <div className="px-3 pb-2 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    {originalVals && (
                      <div className="bg-red-50 dark:bg-red-950 p-2 overflow-auto max-h-24">
                        <div className="text-red-500 font-bold mb-1">ANTES</div>
                        {Object.entries(originalVals).map(([k, v]) => (
                          <div key={k} className="text-red-700 dark:text-red-300">
                            <span className="opacity-60">{k}: </span>{String(v)}
                          </div>
                        ))}
                      </div>
                    )}
                    {newVals && (
                      <div className="bg-green-50 dark:bg-green-950 p-2 overflow-auto max-h-24">
                        <div className="text-green-600 font-bold mb-1">DESPUÉS</div>
                        {Object.entries(newVals).map(([k, v]) => {
                          const changed = originalVals && originalVals[k] !== v;
                          return (
                            <div key={k} className={cn("dark:text-green-300", changed ? "text-green-700 font-bold" : "text-green-600 opacity-70")}>
                              <span className="opacity-60">{k}: </span>{String(v)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
