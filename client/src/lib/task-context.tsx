import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { Task, LogEntry, TaskStatus, TaskType } from './types';
import { format, parse, isValid, isBefore, startOfDay } from 'date-fns';

interface State {
  tasks: Task[];
  logs: LogEntry[];
  lastId: number;
}

type Action =
  | { type: 'LOAD_STATE'; payload: State }
  | { type: 'ADD_TASK'; payload: Task; source: LogEntry['source'] }
  | { type: 'UPDATE_TASK'; payload: { id: number; updates: Partial<Task> }; source: LogEntry['source'] }
  | { type: 'DELETE_TASK'; payload: { id: number }; source: LogEntry['source'] }
  | { type: 'COMPLETE_TASK'; payload: { id: number }; source: LogEntry['source'] }
  | { type: 'MOVE_EXPIRED'; source: LogEntry['source'] }
  | { type: 'IMPORT_CSV'; payload: Task[]; source: LogEntry['source'] }
  | { type: 'DELETE_ALL_ACTIVE'; source: LogEntry['source'] };

const initialState: State = {
  tasks: [],
  logs: [],
  lastId: 0,
};

function reducer(state: State, action: Action): State {
  const timestamp = new Date().toISOString();

  switch (action.type) {
    case 'LOAD_STATE':
      return action.payload;

    case 'ADD_TASK': {
      const log: LogEntry = {
        id: crypto.randomUUID(),
        timestamp,
        action: 'CREATE',
        details: `Created task ${action.payload.id}`,
        taskId: action.payload.id,
        newValues: action.payload,
        source: action.source,
      };
      return {
        ...state,
        tasks: [...state.tasks, action.payload],
        logs: [log, ...state.logs],
        lastId: Math.max(state.lastId, action.payload.id),
      };
    }

    case 'UPDATE_TASK': {
      const task = state.tasks.find((t) => t.id === action.payload.id);
      if (!task) return state;
      const updatedTask = { ...task, ...action.payload.updates, updatedAt: timestamp };
      
      const log: LogEntry = {
        id: crypto.randomUUID(),
        timestamp,
        action: 'UPDATE',
        details: `Updated task ${task.id}`,
        taskId: task.id,
        originalValues: task,
        newValues: updatedTask,
        source: action.source,
      };

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? updatedTask : t)),
        logs: [log, ...state.logs],
      };
    }

    case 'DELETE_TASK': {
      const task = state.tasks.find((t) => t.id === action.payload.id);
      if (!task) return state;
      const updatedTask: Task = { ...task, status: 'eliminada', updatedAt: timestamp };

      const log: LogEntry = {
        id: crypto.randomUUID(),
        timestamp,
        action: 'DELETE',
        details: `Deleted task ${task.id}`,
        taskId: task.id,
        source: action.source,
      };

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? updatedTask : t)),
        logs: [log, ...state.logs],
      };
    }

    case 'COMPLETE_TASK': {
        const task = state.tasks.find((t) => t.id === action.payload.id);
        if (!task) return state;
        const updatedTask: Task = { ...task, status: 'completada', updatedAt: timestamp };
  
        const log: LogEntry = {
          id: crypto.randomUUID(),
          timestamp,
          action: 'COMPLETE',
          details: `Completed task ${task.id}`,
          taskId: task.id,
          source: action.source,
        };
  
        return {
          ...state,
          tasks: state.tasks.map((t) => (t.id === action.payload.id ? updatedTask : t)),
          logs: [log, ...state.logs],
        };
      }

    case 'MOVE_EXPIRED': {
      const today = startOfDay(new Date());
      const todayStr = format(today, 'dd/MM/yy');
      
      const updatedTasks = state.tasks.map(t => {
          if (t.status !== 'activa' || t.date === 'a definir') return t;
          
          try {
             const taskDate = parse(t.date, 'dd/MM/yy', new Date());
             if (isValid(taskDate) && isBefore(taskDate, today)) {
                 return { ...t, date: todayStr, updatedAt: timestamp };
             }
          } catch(e) {
              // ignore invalid dates
          }
          return t;
      });

      // Count changes
      const changedCount = updatedTasks.filter((t, i) => t.date !== state.tasks[i].date).length;
      
      if (changedCount === 0) return state;

      const log: LogEntry = {
          id: crypto.randomUUID(),
          timestamp,
          action: 'MOVE_EXPIRED',
          details: `Moved ${changedCount} expired tasks to today`,
          source: action.source,
      };

      return {
        ...state,
        tasks: updatedTasks,
        logs: [log, ...state.logs]
      };
    }

    case 'IMPORT_CSV': {
      let currentId = state.lastId;
      const newTasks = action.payload.map(t => {
        currentId++;
        return { ...t, id: currentId };
      });

      const log: LogEntry = {
         id: crypto.randomUUID(),
         timestamp,
         action: 'IMPORT',
         details: `Imported ${newTasks.length} tasks`,
         source: action.source
      };

      return {
        ...state,
        tasks: [...state.tasks, ...newTasks],
        logs: [log, ...state.logs],
        lastId: currentId
      };
    }
    
    case 'DELETE_ALL_ACTIVE': {
        const activeTasks = state.tasks.filter(t => t.status === 'activa');
        const updatedTasks = state.tasks.map(t => t.status === 'activa' ? { ...t, status: 'eliminada' as TaskStatus, updatedAt: timestamp } : t);
        
        const log: LogEntry = {
            id: crypto.randomUUID(),
            timestamp,
            action: 'DELETE_ALL',
            details: `Deleted ${activeTasks.length} active tasks`,
            source: action.source
        };

        return {
            ...state,
            tasks: updatedTasks,
            logs: [log, ...state.logs]
        };
    }

    default:
      return state;
  }
}

const TaskContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('taskmaster-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_STATE', payload: parsed });
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('taskmaster-state', JSON.stringify(state));
  }, [state]);

  return (
    <TaskContext.Provider value={{ state, dispatch }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within TaskProvider');
  return context;
}
