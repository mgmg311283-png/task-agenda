import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '@/lib/types';
import { TaskCard } from './task-card';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';
import { isToday } from '@/lib/date-utils';
import { useTasks } from '@/lib/task-context';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { CalendarArrowUp } from 'lucide-react';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  color: 'urgent' | 'action' | 'think';
  isLoading?: boolean;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
  onDuplicate?: (task: Task) => void;
  isFiltered?: boolean;
}

const EMPTY_MESSAGES = {
  urgent: { label: 'SIN URGENTES', sub: 'Todo bajo control' },
  action: { label: 'SIN ACCIONES', sub: 'Arrastrá tareas aquí' },
  think: { label: 'SIN IDEAS', sub: 'Arrastrá tareas aquí' },
};

export function KanbanColumn({ id, title, tasks, color, isLoading, onComplete, onDelete, onUpdate, onDuplicate, isFiltered }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  const { pushTodayAsync } = useTasks();
  const [isPushing, setIsPushing] = useState(false);

  const colorStyles = {
    urgent: "bg-urgent border-urgent-foreground/20 text-urgent-foreground",
    action: "bg-action border-action-foreground/20 text-action-foreground",
    think: "bg-think border-think-foreground/20 text-think-foreground",
  };

  const dotColors = {
    urgent: 'bg-red-500',
    action: 'bg-blue-500',
    think: 'bg-yellow-500',
  };

  const empty = EMPTY_MESSAGES[color];

  const todayCount = color === 'urgent' ? tasks.filter(t => isToday(t.date)).length : 0;

  const pushTodayToTomorrow = async () => {
    if (todayCount === 0 || isPushing) return;
    setIsPushing(true);
    try {
      const result = await pushTodayAsync('UI');
      toast({
        title: `${result.moved} tarea${result.moved === 1 ? '' : 's'} a mañana`,
        description: result.moved > 0 ? `Nueva fecha: ${result.date}` : undefined,
      });
    } catch (err) {
      toast({
        title: 'No se pudieron pasar las tareas',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full md:min-w-[0] md:flex-1 border-r last:border-r-0 border-border bg-background shadow-sm">
      {/* Header — hidden on mobile since tabs handle it */}
      <div className={cn(
        "px-4 py-3 border-b hidden md:flex justify-between items-center sticky top-0 z-10 font-mono tracking-tight shadow-sm",
        colorStyles[color]
      )}>
        <h3 className="font-bold text-sm uppercase flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", dotColors[color])} />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {color === 'urgent' && (
            <button
              onClick={pushTodayToTomorrow}
              disabled={todayCount === 0 || isPushing}
              className={cn(
                "flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border transition-colors",
                todayCount === 0 || isPushing
                  ? "opacity-40 cursor-default border-transparent"
                  : "bg-black/5 border-black/10 hover:bg-black/10"
              )}
              title={todayCount === 0 ? "No hay tareas de hoy" : `Pasar ${todayCount} tarea${todayCount === 1 ? '' : 's'} de hoy a mañana`}
              data-testid="btn-push-today-to-tomorrow"
            >
              <CalendarArrowUp className="w-3 h-3" />
              {todayCount > 0 && <span>{todayCount}</span>}
            </button>
          )}
          <span className="text-xs font-bold opacity-60 bg-black/5 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20">
        <div className="p-3 pb-20">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="border border-border p-3 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="min-h-[100px] space-y-3">
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onUpdate={onUpdate}
                    onDuplicate={onDuplicate}
                  />
                ))}
                {tasks.length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-border opacity-40">
                    {/* Con filtros puestos, "SIN URGENTES / Todo bajo control"
                        hacia creer que no habia trabajo pendiente cuando en
                        realidad estaba oculto por un filtro. */}
                    <span className="text-muted-foreground text-xs font-mono mb-1">
                      {isFiltered ? 'SIN RESULTADOS' : empty.label}
                    </span>
                    <span className="text-muted-foreground/60 text-[10px]">
                      {isFiltered ? 'Hay filtros activos' : empty.sub}
                    </span>
                  </div>
                )}
              </div>
            </SortableContext>
          )}
        </div>
      </div>
    </div>
  );
}
