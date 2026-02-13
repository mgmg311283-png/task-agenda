import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '@/lib/types';
import { TaskCard } from './task-card';
import { cn } from '@/lib/utils';
import { ScrollArea } from './scroll-area';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  color: 'urgent' | 'action' | 'think';
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
}

export function KanbanColumn({ id, title, tasks, color, onComplete, onDelete, onUpdate }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  const colorStyles = {
    urgent: "bg-urgent border-urgent-foreground/20 text-urgent-foreground",
    action: "bg-action border-action-foreground/20 text-action-foreground",
    think: "bg-think border-think-foreground/20 text-think-foreground",
  };

  return (
    <div className="flex flex-col h-full min-w-[300px] md:min-w-[0] md:flex-1 border-r last:border-r-0 md:border-r-1 border-border bg-white shadow-sm">
      {/* Header */}
      <div className={cn(
        "px-4 py-3 border-b flex justify-between items-center sticky top-0 z-10 font-mono tracking-tight shadow-sm",
        colorStyles[color]
      )}>
        <h3 className="font-bold text-sm uppercase flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", 
                color === 'urgent' ? 'bg-red-500' : 
                color === 'action' ? 'bg-blue-500' : 'bg-yellow-500'
            )} />
            {title}
        </h3>
        <span className="text-xs font-bold opacity-60 bg-black/5 px-2 py-0.5 rounded-full">
            {tasks.length}
        </span>
      </div>

      {/* Content */}
      <div ref={setNodeRef} className="flex-1 overflow-hidden bg-gray-50/30">
        <ScrollArea className="h-full">
            <div className="p-3 pb-20">
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="min-h-[100px] space-y-3">
                    {tasks.map(task => (
                    <TaskCard 
                        key={task.id} 
                        task={task} 
                        onComplete={onComplete}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                    />
                    ))}
                    {tasks.length === 0 && (
                        <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg opacity-50">
                            <span className="text-gray-400 text-xs font-mono mb-1">VACÍO</span>
                            <span className="text-gray-300 text-[10px]">Arrastra tareas aquí</span>
                        </div>
                    )}
                </div>
                </SortableContext>
            </div>
        </ScrollArea>
      </div>
    </div>
  );
}
