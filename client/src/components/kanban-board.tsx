import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { KanbanColumn } from './ui/kanban-column';
import { useTasks } from '@/lib/task-context';
import { Task, COLUMNS } from '@/lib/types';
import { TaskCard } from './ui/task-card';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

function getSortedTasks(tasks: Task[], columnId: string): Task[] {
    const colTasks = tasks.filter(t => {
        if (t.status !== 'activa') return false;
        if (columnId === 'urgent') return t.urgent;
        if (columnId === 'action') return !t.urgent && (t.type === 'accion' || t.type === 'a_definir');
        if (columnId === 'think') return !t.urgent && t.type === 'para_pensar';
        return false;
    });

    return colTasks.sort((a, b) => {
        const dateA = a.date === 'a definir' ? '0000-00-00' : a.date.split('/').reverse().join('-');
        const dateB = b.date === 'a definir' ? '0000-00-00' : b.date.split('/').reverse().join('-');

        const priorityPersons = ['mariano', 'aldana'];
        const getPersonWeight = (p: string) => {
            const lower = p.toLowerCase();
            if (lower === 'a definir') return 0;
            if (priorityPersons.includes(lower)) return 1;
            return 2;
        };

        if (columnId === 'urgent') {
            const pA = getPersonWeight(a.person);
            const pB = getPersonWeight(b.person);
            if (pA !== pB) return pA - pB;
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return a.id - b.id;
        } else {
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const pA = getPersonWeight(a.person);
            const pB = getPersonWeight(b.person);
            if (pA !== pB) return pA - pB;
            return a.id - b.id;
        }
    });
}

const TAB_COLORS = {
  urgent: { dot: 'bg-red-500', active: 'border-red-500 text-red-700', badge: 'bg-red-100 text-red-700' },
  action: { dot: 'bg-blue-500', active: 'border-blue-500 text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  think: { dot: 'bg-yellow-500', active: 'border-yellow-500 text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
} as const;

export function KanbanBoard() {
  const { state, dispatch } = useTasks();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<string>('urgent');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    let targetColumnId = over.id as string;
    
    if (typeof over.id === 'number') {
       if (over.data.current?.sortable?.containerId) {
           targetColumnId = over.data.current.sortable.containerId;
       }
    }

    if (!['urgent', 'action', 'think'].includes(targetColumnId)) {
        const overTask = state.tasks.find(t => t.id === over.id);
        if (overTask) {
             if (overTask.urgent) targetColumnId = 'urgent';
             else if (overTask.type === 'para_pensar') targetColumnId = 'think';
             else targetColumnId = 'action';
        } else {
            return; 
        }
    }

    const taskId = active.id as number;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const updates: Partial<Task> = {};
    if (targetColumnId === 'urgent') {
        updates.urgent = true;
    } else if (targetColumnId === 'action') {
        updates.urgent = false;
        updates.type = 'accion';
    } else if (targetColumnId === 'think') {
        updates.urgent = false;
        updates.type = 'para_pensar';
    }

    if (task.urgent !== updates.urgent || (updates.type && task.type !== updates.type)) {
        dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, updates }, source: 'UI' });
    }
  };

  const activeTask = activeId ? state.tasks.find(t => t.id === activeId) : null;

  const columnCounts = COLUMNS.reduce((acc, col) => {
    acc[col.id] = getSortedTasks(state.tasks, col.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
      {/* Mobile Tab Bar */}
      <div className="flex md:hidden border-b border-border bg-white sticky top-0 z-20" data-testid="mobile-tab-bar">
        {COLUMNS.map(col => {
          const colors = TAB_COLORS[col.id as keyof typeof TAB_COLORS];
          const isActive = mobileTab === col.id;
          return (
            <button
              key={col.id}
              data-testid={`tab-${col.id}`}
              onClick={() => setMobileTab(col.id)}
              className={cn(
                "flex-1 py-3 px-2 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5",
                isActive
                  ? colors.active
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
              <span className="truncate">{col.title}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px]",
                isActive ? colors.badge : "bg-gray-100 text-gray-500"
              )}>
                {columnCounts[col.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop: All columns side by side */}
      <div className="hidden md:flex h-full overflow-hidden bg-gray-100/50">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            tasks={getSortedTasks(state.tasks, col.id)}
            color={col.color as any}
            onComplete={(id) => dispatch({ type: 'COMPLETE_TASK', payload: { id }, source: 'UI' })}
            onDelete={(id) => dispatch({ type: 'DELETE_TASK', payload: { id }, source: 'UI' })}
            onUpdate={(id, data) => dispatch({ type: 'UPDATE_TASK', payload: { id, updates: data }, source: 'UI' })}
          />
        ))}
      </div>

      {/* Mobile: Only show the active tab's column */}
      <div className="flex md:hidden h-full overflow-hidden bg-gray-100/50">
        {COLUMNS.filter(col => col.id === mobileTab).map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            tasks={getSortedTasks(state.tasks, col.id)}
            color={col.color as any}
            onComplete={(id) => dispatch({ type: 'COMPLETE_TASK', payload: { id }, source: 'UI' })}
            onDelete={(id) => dispatch({ type: 'DELETE_TASK', payload: { id }, source: 'UI' })}
            onUpdate={(id, data) => dispatch({ type: 'UPDATE_TASK', payload: { id, updates: data }, source: 'UI' })}
          />
        ))}
      </div>
      
      {createPortal(
        <DragOverlay>
          {activeTask ? (
             <div className="opacity-90 rotate-2 scale-105 cursor-grabbing w-[300px]">
                <TaskCard 
                    task={activeTask} 
                    onComplete={() => {}} 
                    onDelete={() => {}} 
                    onUpdate={() => {}}
                />
             </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
