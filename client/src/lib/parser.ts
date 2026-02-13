import { Task, TaskType } from './types';
import { format, parse, isValid, isBefore, startOfDay } from 'date-fns';

export function parseCommand(input: string, nextId: number): { 
  action: 'create' | 'update' | 'delete' | 'complete' | 'move_expired' | 'export' | 'unknown' | 'help';
  payload?: any;
  message?: string;
} {
  const lower = input.toLowerCase().trim();

  // 1. GLOBAL COMMANDS
  if (lower.includes('mover vencidas')) return { action: 'move_expired' };
  if (lower.includes('exportar')) return { action: 'export' };
  if (lower === 'ayuda' || lower === 'help') return { action: 'help' };

  // 2. DELETE
  if (lower.startsWith('eliminar') || lower.startsWith('borrar') || lower.startsWith('sacar')) {
    const match = lower.match(/\d+/);
    if (match) {
      return { action: 'delete', payload: { id: parseInt(match[0]) } };
    }
    return { action: 'unknown', message: 'Para eliminar, indica el número. Ej: "eliminar 12"' };
  }

  // 3. COMPLETE
  if (lower.startsWith('completar') || lower.startsWith('hecha') || lower.startsWith('listo')) {
    const match = lower.match(/\d+/);
    if (match) {
      return { action: 'complete', payload: { id: parseInt(match[0]) } };
    }
    return { action: 'unknown', message: 'Para completar, indica el número. Ej: "completar 12"' };
  }

  // 4. UPDATE (Complex regex needed, or simplified keyword matching)
  // Check for "cambiar [id] ..."
  if (lower.startsWith('cambiar') || lower.startsWith('modificar')) {
    const idMatch = lower.match(/\d+/);
    if (!idMatch) return { action: 'unknown', message: 'Indica el número de tarea a modificar.' };
    
    const id = parseInt(idMatch[0]);
    const payload: Partial<Task> = { id };
    
    // Date parsing
    if (lower.includes('fecha')) {
       // Simple date extraction logic would go here
       // For now, let's just support "hoy", "mañana"
       if (lower.includes('hoy')) payload.date = format(new Date(), 'dd/MM/yy');
       else if (lower.includes('mañana')) payload.date = format(new Date(Date.now() + 86400000), 'dd/MM/yy');
       else payload.date = 'a definir'; 
    }
    
    if (lower.includes('urgente')) {
       if (lower.includes('no urgente') || lower.includes('sacar urgente')) payload.urgent = false;
       else payload.urgent = true;
    }

    return { action: 'update', payload };
  }

  // 5. CREATE
  // Default action if no other keyword matches but looks like a task
  if (lower.startsWith('hay que') || lower.startsWith('tarea:') || lower.startsWith('agregar')) {
    let text = input;
    // Strip prefixes
    text = text.replace(/^(hay que|tarea:|agregar tarea:|agregar)\s*/i, '');
    
    const payload: Partial<Task> = {
      id: nextId,
      text: text,
      date: 'a definir',
      person: 'a definir',
      type: 'a_definir',
      urgent: false,
      status: 'activa'
    };

    // Simple heuristic extraction
    if (text.includes('urgente')) {
      payload.urgent = true;
      payload.text = payload.text?.replace('urgente', '').trim();
    }
    
    return { action: 'create', payload };
  }

  return { action: 'unknown', message: 'No entendí el comando. Intenta "tarea: comprar pan" o "completar 12".' };
}

export function isTaskOverdue(dateStr: string): boolean {
  if (dateStr === 'a definir') return false;
  // Parse dd/mm/yy
  try {
    const date = parse(dateStr, 'dd/MM/yy', new Date());
    if (!isValid(date)) return false;
    return isBefore(date, startOfDay(new Date()));
  } catch {
    return false;
  }
}
