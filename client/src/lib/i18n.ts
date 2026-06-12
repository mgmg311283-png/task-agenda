import type { Language } from './types';

export const translations = {
  es: {
    app: {
      title: 'FOCUS',
      version: 'v1.0',
      subtitle: 'Gestor de Tareas',
    },
    board: {
      urgent: 'URGENTE',
      action: 'ACCION',
      think: 'PENSAR',
    },
    actions: {
      search: 'Buscar tareas...',
      undo: 'Deshacer',
      redo: 'Rehacer',
      newTask: 'Nueva tarea',
      showShortcuts: 'Mostrar atajos',
      export: 'Exportar',
      import: 'Importar',
      delete: 'Eliminar',
      complete: 'Completar',
      filter: 'Filtrar',
    },
    stats: {
      active: 'activas',
      completed: 'completadas',
      overdue: 'vencidas',
    },
    shortcuts: {
      title: 'Atajos de Teclado',
      undo: 'Deshacer',
      redo: 'Rehacer',
      newTask: 'Nueva tarea',
      focusChat: 'Enfocar chat',
      exitChat: 'Salir del chat',
      showShortcuts: 'Mostrar atajos',
    },
  },
  en: {
    app: {
      title: 'FOCUS',
      version: 'v1.0',
      subtitle: 'Task Manager',
    },
    board: {
      urgent: 'URGENT',
      action: 'ACTION',
      think: 'THINK',
    },
    actions: {
      search: 'Search tasks...',
      undo: 'Undo',
      redo: 'Redo',
      newTask: 'New task',
      showShortcuts: 'Show shortcuts',
      export: 'Export',
      import: 'Import',
      delete: 'Delete',
      complete: 'Complete',
      filter: 'Filter',
    },
    stats: {
      active: 'active',
      completed: 'completed',
      overdue: 'overdue',
    },
    shortcuts: {
      title: 'Keyboard Shortcuts',
      undo: 'Undo',
      redo: 'Redo',
      newTask: 'New task',
      focusChat: 'Focus chat',
      exitChat: 'Exit chat',
      showShortcuts: 'Show shortcuts',
    },
  },
  pt: {
    app: {
      title: 'FOCUS',
      version: 'v1.0',
      subtitle: 'Gerenciador de Tarefas',
    },
    board: {
      urgent: 'URGENTE',
      action: 'AÇÃO',
      think: 'PENSAR',
    },
    actions: {
      search: 'Buscar tarefas...',
      undo: 'Desfazer',
      redo: 'Refazer',
      newTask: 'Nova tarefa',
      showShortcuts: 'Mostrar atalhos',
      export: 'Exportar',
      import: 'Importar',
      delete: 'Deletar',
      complete: 'Completar',
      filter: 'Filtrar',
    },
    stats: {
      active: 'ativas',
      completed: 'completadas',
      overdue: 'vencidas',
    },
    shortcuts: {
      title: 'Atalhos de Teclado',
      undo: 'Desfazer',
      redo: 'Refazer',
      newTask: 'Nova tarefa',
      focusChat: 'Focar chat',
      exitChat: 'Sair do chat',
      showShortcuts: 'Mostrar atalhos',
    },
  },
};

export function useTranslation(lang: Language) {
  return translations[lang] || translations.es;
}

export function setLanguage(lang: Language) {
  localStorage.setItem('app-language', lang);
}

export function getLanguage(): Language {
  const saved = localStorage.getItem('app-language') as Language | null;
  return saved || 'es';
}
