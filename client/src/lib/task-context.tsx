import React, { createContext, useContext, useCallback, ReactNode, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import { Task, LogEntry } from './types';

interface TaskContextValue {
  state: {
    tasks: Task[];
    allTasks: Task[];
    logs: LogEntry[];
    lastId: number;
    isLoading: boolean;
  };
  dispatch: (action: Action) => void;
  moveExpiredAsync: (source: string) => Promise<{ moved: number; date: string }>;
  moveUrgentToActionAsync: (source: string) => Promise<{ moved: number }>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

type Action =
  | { type: 'ADD_TASK'; payload: Partial<Task>; source: string }
  | { type: 'UPDATE_TASK'; payload: { id: number; updates: Partial<Task> }; source: string }
  | { type: 'DELETE_TASK'; payload: { id: number }; source: string }
  | { type: 'COMPLETE_TASK'; payload: { id: number }; source: string }
  | { type: 'MOVE_EXPIRED'; source: string }
  | { type: 'MOVE_URGENT_TO_ACTION'; source: string }
  | { type: 'IMPORT_CSV'; payload: Partial<Task>[]; source: string }
  | { type: 'DELETE_ALL_ACTIVE'; source: string };

const TaskContext = createContext<TaskContextValue | null>(null);

interface HistoryItem {
  id: number;
  before: Partial<Task>;
  after: Partial<Task>;
}

interface HistoryEntry {
  items: HistoryItem[];
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks/all'],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const { data: logs = [] } = useQuery<LogEntry[]>({
    queryKey: ['/api/logs'],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    queryClient.invalidateQueries({ queryKey: ['/api/tasks/all'] });
    queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
  }, [queryClient]);

  const recordHistory = useCallback((items: HistoryItem[]) => {
    if (items.length === 0) return;
    setUndoStack(prev => [...prev, { items }]);
    setRedoStack([]);
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: { task: Partial<Task>; source: string }): Promise<Task> => {
      const res = await apiRequest('POST', '/api/tasks', { ...data.task, source: data.source });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Task>; source: string }) => {
      const res = await apiRequest('PATCH', `/api/tasks/${data.id}`, { ...data.updates, source: data.source });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const completeMutation = useMutation({
    mutationFn: async (data: { id: number; source: string }) => {
      const res = await apiRequest('POST', `/api/tasks/${data.id}/complete`, { source: data.source });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (data: { id: number; source: string }) => {
      const res = await apiRequest('DELETE', `/api/tasks/${data.id}`, { source: data.source });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const moveExpiredMutation = useMutation({
    mutationFn: async (data: { source: string }): Promise<{ moved: number; date: string; changes: { id: number; before: string; after: string }[] }> => {
      const res = await apiRequest('POST', '/api/tasks/move-expired', { source: data.source });
      return res.json();
    },
    onSuccess: (result) => {
      recordHistory(result.changes.map(c => ({ id: c.id, before: { date: c.before }, after: { date: c.after } })));
      invalidate();
    },
  });

  const moveExpiredAsync = useCallback(async (source: string) => {
    return moveExpiredMutation.mutateAsync({ source });
  }, [moveExpiredMutation]);

  const moveUrgentToActionMutation = useMutation({
    mutationFn: async (data: { source: string }): Promise<{ moved: number; changes: { id: number; beforeType: string }[] }> => {
      const res = await apiRequest('POST', '/api/tasks/urgent-to-action', { source: data.source });
      return res.json();
    },
    onSuccess: (result) => {
      recordHistory(result.changes.map(c => ({
        id: c.id,
        before: { urgent: true, type: c.beforeType as Task['type'] },
        after: { urgent: false, type: 'accion' },
      })));
      invalidate();
    },
  });

  const moveUrgentToActionAsync = useCallback(async (source: string) => {
    return moveUrgentToActionMutation.mutateAsync({ source });
  }, [moveUrgentToActionMutation]);

  const deleteAllMutation = useMutation({
    mutationFn: async (data: { source: string }): Promise<{ deleted: number; ids: number[] }> => {
      const res = await apiRequest('POST', '/api/tasks/delete-all', { source: data.source });
      return res.json();
    },
    onSuccess: (result) => {
      recordHistory(result.ids.map(id => ({ id, before: { status: 'activa' }, after: { status: 'eliminada' } })));
      invalidate();
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: { tasks: Partial<Task>[]; source: string }): Promise<Task[]> => {
      const res = await apiRequest('POST', '/api/tasks/import', { tasks: data.tasks });
      return res.json();
    },
    onSuccess: (created) => {
      recordHistory(created.map(t => ({ id: t.id, before: { status: 'eliminada' }, after: { status: 'activa' } })));
      invalidate();
    },
  });

  const lastId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) : 0;

  const findTask = useCallback((id: number) => {
    return tasks.find(t => t.id === id) || allTasks.find(t => t.id === id);
  }, [tasks, allTasks]);

  const dispatch = useCallback((action: Action) => {
    switch (action.type) {
      case 'ADD_TASK':
        createMutation.mutate({ task: action.payload, source: action.source }, {
          onSuccess: (created) => {
            recordHistory([{ id: created.id, before: { status: 'eliminada' }, after: { status: 'activa' } }]);
          },
        });
        break;
      case 'UPDATE_TASK': {
        const current = findTask(action.payload.id);
        if (current) {
          const keys = Object.keys(action.payload.updates) as (keyof Task)[];
          const before: Partial<Task> = {};
          keys.forEach(k => { (before as any)[k] = current[k]; });
          recordHistory([{ id: action.payload.id, before, after: action.payload.updates }]);
        }
        updateMutation.mutate({ id: action.payload.id, updates: action.payload.updates, source: action.source });
        break;
      }
      case 'DELETE_TASK': {
        const current = findTask(action.payload.id);
        recordHistory([{ id: action.payload.id, before: { status: current?.status || 'activa' }, after: { status: 'eliminada' } }]);
        deleteMutation.mutate({ id: action.payload.id, source: action.source });
        break;
      }
      case 'COMPLETE_TASK': {
        const current = findTask(action.payload.id);
        recordHistory([{ id: action.payload.id, before: { status: current?.status || 'activa' }, after: { status: 'completada' } }]);
        completeMutation.mutate({ id: action.payload.id, source: action.source });
        break;
      }
      case 'MOVE_EXPIRED':
        moveExpiredMutation.mutate({ source: action.source });
        break;
      case 'MOVE_URGENT_TO_ACTION':
        moveUrgentToActionMutation.mutate({ source: action.source });
        break;
      case 'IMPORT_CSV':
        importMutation.mutate({ tasks: action.payload, source: action.source });
        break;
      case 'DELETE_ALL_ACTIVE':
        deleteAllMutation.mutate({ source: action.source });
        break;
    }
  }, [createMutation, updateMutation, deleteMutation, completeMutation, moveExpiredMutation, moveUrgentToActionMutation, importMutation, deleteAllMutation, findTask, recordHistory]);

  const applyItems = useCallback((items: HistoryItem[], direction: 'before' | 'after') => {
    items.forEach(item => {
      updateMutation.mutate({ id: item.id, updates: item[direction], source: 'UI' });
    });
  }, [updateMutation]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      applyItems(entry.items, 'before');
      setRedoStack(r => [...r, entry]);
      return prev.slice(0, -1);
    });
  }, [applyItems]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      applyItems(entry.items, 'after');
      setUndoStack(u => [...u, entry]);
      return prev.slice(0, -1);
    });
  }, [applyItems]);

  const state = {
    tasks,
    allTasks,
    logs,
    lastId,
    isLoading: tasksLoading,
  };

  return (
    <TaskContext.Provider value={{
      state,
      dispatch,
      moveExpiredAsync,
      moveUrgentToActionAsync,
      undo,
      redo,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within TaskProvider');
  return context;
}
