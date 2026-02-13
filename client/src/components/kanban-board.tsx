import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { KanbanColumn } from './ui/kanban-column';
import { useTasks } from '@/lib/task-context';
import { Task, COLUMNS } from '@/lib/types';
import { TaskCard } from './ui/task-card';
import { useState } from 'react';
import { createPortal } from 'react-dom';

// Sorting Helper
function getSortedTasks(tasks: Task[], columnId: string): Task[] {
    const colTasks = tasks.filter(t => {
        if (t.status !== 'activa') return false;
        if (columnId === 'urgent') return t.urgent;
        if (columnId === 'action') return !t.urgent && (t.type === 'accion' || t.type === 'a_definir');
        if (columnId === 'think') return !t.urgent && t.type === 'para_pensar';
        return false;
    });

    return colTasks.sort((a, b) => {
        // Shared logic: "A definir" dates always first
        const dateA = a.date === 'a definir' ? '0000-00-00' : a.date.split('/').reverse().join('-');
        const dateB = b.date === 'a definir' ? '0000-00-00' : b.date.split('/').reverse().join('-');

        // Priority Persons
        const priorityPersons = ['mariano', 'aldana'];
        const getPersonWeight = (p: string) => {
            const lower = p.toLowerCase();
            if (lower === 'a definir') return 0;
            if (priorityPersons.includes(lower)) return 1;
            return 2;
        };

        if (columnId === 'urgent') {
            // 1. Person Priority
            const pA = getPersonWeight(a.person);
            const pB = getPersonWeight(b.person);
            if (pA !== pB) return pA - pB;
            
            // 2. Date
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            
            // 3. Number
            return a.id - b.id;
        } else {
            // Action & Think: Date -> Person -> Number
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            
            const pA = getPersonWeight(a.person);
            const pB = getPersonWeight(b.person);
            if (pA !== pB) return pA - pB;
            
            return a.id - b.id;
        }
    });
}

export function KanbanBoard() {
  const { state, dispatch } = useTasks();
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Prevent accidental drags
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Determine target column
    let targetColumnId = over.id as string;
    
    // Check if dropped on a task
    if (typeof over.id === 'number') {
       if (over.data.current?.sortable?.containerId) {
           targetColumnId = over.data.current.sortable.containerId;
       }
    }

    // Validation
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

    // Apply Logic
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

    // Only update if changed
    if (task.urgent !== updates.urgent || (updates.type && task.type !== updates.type)) {
        dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, updates }, source: 'UI' });
    }
  };

  const activeTask = activeId ? state.tasks.find(t => t.id === activeId) : null;

  return (
    <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col md:flex-row h-full overflow-x-auto md:overflow-hidden bg-gray-100/50">
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
