import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '@/lib/types';
import { TaskCard } from './task-card';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

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
}

const EMPTY_MESSAGES = {
  urgent: { label: 'SIN URGENTES', sub: 'Todo bajo control' },
  action: { label: 'SIN ACCIONES', sub: 'Arrastrá tareas aquí' },
  think: { label: 'SIN IDEAS', sub: 'Arrastrá tareas aquí' },
};

export function KanbanColumn({ id, title, tasks, color, isLoading, onComplete, onDelete, onUpdate, onDuplicate }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

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
        <span className="text-xs font-bold opacity-60 bg-black/5 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
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
                    <span className="text-muted-foreground text-xs font-mono mb-1">{empty.label}</span>
                    <span className="text-muted-foreground/60 text-[10px]">{empty.sub}</span>
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
