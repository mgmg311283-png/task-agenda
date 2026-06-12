export type TaskType = 'accion' | 'para_pensar' | 'a_definir';
export type TaskStatus = 'activa' | 'completada' | 'eliminada';
export type TaskPriority = 'baja' | 'normal' | 'alta';
export type Language = 'es' | 'en' | 'pt';

export const LANGUAGES = {
  es: { name: 'Español', flag: '🇦🇷' },
  en: { name: 'English', flag: '🇺🇸' },
  pt: { name: 'Português', flag: '🇧🇷' }
};

export interface Task {
  id: number;
  text: string;
  date: string; // "dd/mm/yy" or "a definir"
  person: string;
  type: TaskType;
  urgent: boolean;
  status: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  dueTime?: string; // "HH:mm" format
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  taskId?: number;
  originalValues?: string | null;
  newValues?: string | null;
  source: string;
}

export const COLUMNS = [
  { id: 'urgent', title: 'URGENTE', color: 'urgent' },
  { id: 'action', title: 'ACCION', color: 'action' },
  { id: 'think', title: 'PENSAR', color: 'think' },
] as const;
