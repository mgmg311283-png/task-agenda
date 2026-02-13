import React, { createContext, useContext, useCallback, ReactNode } from 'react';
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
}

type Action =
  | { type: 'ADD_TASK'; payload: Partial<Task>; source: string }
  | { type: 'UPDATE_TASK'; payload: { id: number; updates: Partial<Task> }; source: string }
  | { type: 'DELETE_TASK'; payload: { id: number }; source: string }
  | { type: 'COMPLETE_TASK'; payload: { id: number }; source: string }
  | { type: 'MOVE_EXPIRED'; source: string }
  | { type: 'IMPORT_CSV'; payload: Partial<Task>[]; source: string }
  | { type: 'DELETE_ALL_ACTIVE'; source: string };

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

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

  const createMutation = useMutation({
    mutationFn: async (data: { task: Partial<Task>; source: string }) => {
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
      const res = await apiRequest('POST', `/api/tasks/${data.id}/delete`, { source: data.source });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const moveExpiredMutation = useMutation({
    mutationFn: async (data: { source: string }) => {
      const res = await apiRequest('POST', '/api/tasks/move-expired', { source: data.source });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (data: { source: string }) => {
      const res = await apiRequest('POST', '/api/tasks/delete-all', { source: data.source });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const importMutation = useMutation({
    mutationFn: async (data: { tasks: Partial<Task>[]; source: string }) => {
      const res = await apiRequest('POST', '/api/tasks/import', { tasks: data.tasks });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const lastId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) : 0;

  const dispatch = useCallback((action: Action) => {
    switch (action.type) {
      case 'ADD_TASK':
        createMutation.mutate({ task: action.payload, source: action.source });
        break;
      case 'UPDATE_TASK':
        updateMutation.mutate({ id: action.payload.id, updates: action.payload.updates, source: action.source });
        break;
      case 'DELETE_TASK':
        deleteMutation.mutate({ id: action.payload.id, source: action.source });
        break;
      case 'COMPLETE_TASK':
        completeMutation.mutate({ id: action.payload.id, source: action.source });
        break;
      case 'MOVE_EXPIRED':
        moveExpiredMutation.mutate({ source: action.source });
        break;
      case 'IMPORT_CSV':
        importMutation.mutate({ tasks: action.payload, source: action.source });
        break;
      case 'DELETE_ALL_ACTIVE':
        deleteAllMutation.mutate({ source: action.source });
        break;
    }
  }, [createMutation, updateMutation, deleteMutation, completeMutation, moveExpiredMutation, importMutation, deleteAllMutation]);

  const state = {
    tasks,
    allTasks,
    logs,
    lastId,
    isLoading: tasksLoading,
  };

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
