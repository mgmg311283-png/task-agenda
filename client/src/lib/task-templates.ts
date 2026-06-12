import type { Task } from './types';

export interface TaskTemplate {
  name: string;
  description: string;
  emoji: string;
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    name: 'Reunión',
    description: 'Agendar una reunión',
    emoji: '📅',
    task: {
      text: 'Reunión con [equipo/persona]',
      date: 'a definir',
      person: 'a definir',
      type: 'accion',
      urgent: false,
      status: 'activa',
    },
  },
  {
    name: 'Seguimiento',
    description: 'Hacer seguimiento a un cliente',
    emoji: '📞',
    task: {
      text: 'Seguimiento con [cliente]',
      date: 'a definir',
      person: 'a definir',
      type: 'accion',
      urgent: false,
      status: 'activa',
      priority: 'normal',
    },
  },
  {
    name: 'Revisión',
    description: 'Revisar documento o código',
    emoji: '👁️',
    task: {
      text: 'Revisar [documento/código]',
      date: 'a definir',
      person: 'a definir',
      type: 'para_pensar',
      urgent: false,
      status: 'activa',
    },
  },
  {
    name: 'Bug Fix',
    description: 'Arreglar un bug',
    emoji: '🐛',
    task: {
      text: 'Arreglar bug: [descripción]',
      date: 'a definir',
      person: 'a definir',
      type: 'accion',
      urgent: true,
      status: 'activa',
      priority: 'alta',
    },
  },
  {
    name: 'Brainstorm',
    description: 'Sesión de lluvia de ideas',
    emoji: '💡',
    task: {
      text: 'Brainstorm: [tema]',
      date: 'a definir',
      person: 'a definir',
      type: 'para_pensar',
      urgent: false,
      status: 'activa',
    },
  },
  {
    name: 'Documentar',
    description: 'Documentar un proceso',
    emoji: '📝',
    task: {
      text: 'Documentar: [proceso]',
      date: 'a definir',
      person: 'a definir',
      type: 'accion',
      urgent: false,
      status: 'activa',
    },
  },
];

export function createTaskFromTemplate(template: TaskTemplate): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  return template.task;
}
