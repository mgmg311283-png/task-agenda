import { Task, TaskType } from './types';
import { format, parse, isValid, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import * as chrono from 'chrono-node';

export interface CommandResult {
  action: 'create' | 'update' | 'delete' | 'complete' | 'move_expired' | 'export' | 'unknown' | 'help';
  payload?: any;
  message?: string;
  originalInput?: string;
}

// Synonyms mapping
const KEYWORDS = {
  create: ['tarea', 'nueva', 'agregar', 'crear', 'anotar', 'agendar', 'recordar', 'tengo que', 'hay que', 'hacer'],
  update: ['cambiar', 'modificar', 'editar', 'actualizar', 'mover', 'poner', 'pasar'],
  delete: ['eliminar', 'borrar', 'sacar', 'quitar', 'destruir', 'cancelar'],
  complete: ['completar', 'terminar', 'finalizar', 'listo', 'hecha', 'cerrar', 'chau'],
  urgent: ['urgente', 'asap', 'ya', 'ahora', 'prioridad', 'rapido', 'importantisimo', 'fuego'],
  not_urgent: ['tranqui', 'normal', 'no urgente', 'sacar urgente', 'desmarcar urgente'],
  export: ['exportar', 'bajar', 'descargar', 'csv'],
  move_expired: ['mover vencidas', 'traer vencidas', 'actualizar fechas', 'poner al dia']
};

export function parseCommand(input: string, nextId: number): CommandResult {
  const originalInput = input;
  // Normalize slightly but keep accents for accurate date parsing if needed, though chrono handles them well.
  // We'll lowercase for keyword matching.
  const lower = input.toLowerCase().trim();

  // 1. GLOBAL COMMANDS
  if (KEYWORDS.move_expired.some(k => lower.includes(k))) return { action: 'move_expired', originalInput };
  if (KEYWORDS.export.some(k => lower.includes(k))) return { action: 'export', originalInput };
  if (lower === 'ayuda' || lower === 'help' || lower === 'que puedes hacer') return { action: 'help', originalInput };

  // 2. PARSE ID (if any) - "el 12", "la 5", "#4"
  // We look for standalone digits, or digits preceded by #
  const idMatch = lower.match(/(?:\s|^|#)(\d+)(?:\s|$)/);
  const id = idMatch ? parseInt(idMatch[1]) : null;

  // 3. DETECT INTENT
  let action: CommandResult['action'] = 'create'; // Default
  
  if (id !== null) {
      // If ID is present, it's likely UPDATE, DELETE, or COMPLETE
      if (KEYWORDS.delete.some(k => lower.startsWith(k))) action = 'delete';
      else if (KEYWORDS.complete.some(k => lower.startsWith(k))) action = 'complete';
      else if (KEYWORDS.update.some(k => lower.startsWith(k))) action = 'update';
      else {
          // Ambiguous: "12 urgente" -> Update
          // Ambiguous: "12 comprar pan" -> Update text?
          // Let's assume Update if start doesn't match create keywords explicitly
          if (!KEYWORDS.create.some(k => lower.startsWith(k))) {
              action = 'update';
          }
      }
  } else {
      // No ID, so likely CREATE, unless it's a bulk command (handled in globals)
      // or a specific natural language query "borrar todas" (not implemented yet safety)
  }

  // 4. EXTRACT ENTITIES (Date, Urgency, Person)
  
  // Date Parsing with Chrono (Spanish)
  const parsedDate = chrono.es.parseDate(input, new Date(), { forwardDate: true });
  let dateStr = 'a definir';
  let textWithoutDate = input;

  if (parsedDate) {
      // If the parsed date is valid
      dateStr = format(parsedDate, 'dd/MM/yy');
      
      // Remove the date text from input to clean up the task description
      // We need to find the text that chrono matched
      const results = chrono.es.parse(input, new Date(), { forwardDate: true });
      if (results.length > 0) {
          const matchText = results[0].text;
          // Simple replace (careful if date text appears twice, usually fine to remove first occurrence)
          textWithoutDate = textWithoutDate.replace(matchText, ''); 
      }
  }

  // Urgency
  let urgent = false;
  let updateUrgency = false; // For update command
  let removeUrgency = false; // For update command

  if (KEYWORDS.urgent.some(k => lower.includes(k))) {
      urgent = true;
      updateUrgency = true;
      // Cleanup text (naive remove)
      textWithoutDate = textWithoutDate.replace(/urgente|asap/gi, ''); 
  }
  
  if (KEYWORDS.not_urgent.some(k => lower.includes(k))) {
      urgent = false;
      removeUrgency = true;
      updateUrgency = true; // We are updating urgency field
  }

  // Clean up clean text
  let finalText = textWithoutDate
    .replace(/^\s*(tarea:|hay que|tengo que|agregar|crear|nueva|anotar)\s*/i, '') // Remove create prefixes
    .replace(/^\s*(cambiar|modificar|editar|actualizar)\s*/i, '') // Remove update prefixes
    .replace(/^\s*(eliminar|borrar)\s*/i, '') // Remove delete prefixes
    .replace(/^\s*(completar|terminar)\s*/i, '') // Remove complete prefixes
    .replace(/^(el|la|lo|al)\s+\d+\s*/i, '') // Remove "el 12" prefix residue
    .replace(/\s+/g, ' ')
    .trim();

  // 5. CONSTRUCT RESULT
  
  if (action === 'delete') {
      if (!id) return { action: 'unknown', message: 'Para eliminar necesito el número. Ej: "eliminar 12"', originalInput };
      return { action: 'delete', payload: { id }, originalInput };
  }

  if (action === 'complete') {
      if (!id) return { action: 'unknown', message: 'Para completar necesito el número. Ej: "completar 12"', originalInput };
      return { action: 'complete', payload: { id }, originalInput };
  }

  if (action === 'update') {
      if (!id) return { action: 'unknown', message: 'Para modificar necesito el número. Ej: "cambiar 12 a mañana"', originalInput };
      
      const payload: Partial<Task> = { id };
      
      // If we parsed a date, apply it
      if (parsedDate) payload.date = dateStr;
      
      // If we detected urgency change
      if (updateUrgency) payload.urgent = urgent && !removeUrgency;
      
      // If there is remaining text, update description?
      // "cambiar 12 comprar pan" -> update text
      // "cambiar 12 urgente" -> don't update text to "urgente" (already removed), so text empty
      if (finalText.length > 2) { // Threshold to avoid "el" or garbage
          payload.text = finalText;
      }

      return { action: 'update', payload, originalInput };
  }

  if (action === 'create') {
      // Default creation
      // If parsedDate is null, check if we should default to 'a definir' (handled by init)
      
      // Special case: "comprar pan el viernes" -> Date: Friday, Text: comprar pan
      
      const payload: Partial<Task> = {
          id: nextId,
          text: finalText || 'Nueva tarea', // Fallback if everything was removed
          date: dateStr, // 'a definir' or parsed 'dd/mm/yy'
          person: 'a definir', // We haven't implemented person extraction yet
          type: 'a_definir',
          urgent: urgent,
          status: 'activa'
      };

      // Heuristic for Person (very simple: "para Mariano")
      const personMatch = finalText.match(/\bpara\s+(\w+)/i);
      if (personMatch) {
          payload.person = personMatch[1]; // "Mariano"
          payload.text = payload.text?.replace(personMatch[0], '').trim();
      }

      // Heuristic for Type based on keywords
      if (finalText.toLowerCase().includes('pensar') || finalText.toLowerCase().includes('idea')) {
          payload.type = 'para_pensar';
      } else {
          // Default to action or keep "a_definir" depending on requirements
          // Requirements said "TIPO: accion | para pensar | a definir"
          // Let's guess 'accion' if it's a verb? Hard. Keep 'a_definir' unless explicit.
          // But usually tasks are actions. Let's stick to 'a_definir' to be safe, or 'accion' if date is present?
          // Let's use 'a_definir' as safe default.
          payload.type = 'a_definir';
      }
      
      // Refine Type: If it has date, it's likely an Action.
      if (payload.date !== 'a definir') payload.type = 'accion';

      return { action: 'create', payload, originalInput };
  }

  return { action: 'unknown', message: 'No entendí el comando.', originalInput };
}

export function isTaskOverdue(dateStr: string): boolean {
  if (dateStr === 'a definir') return false;
  try {
    const date = parse(dateStr, 'dd/MM/yy', new Date());
    if (!isValid(date)) return false;
    return isBefore(date, startOfDay(new Date()));
  } catch {
    return false;
  }
}

export function parseMultipleCommands(input: string, startId: number): CommandResult[] {
  // Split by keywords "nueva tarea", "otra tarea", "punto nueva tarea", etc.
  // We use a regex with capturing group to keep the delimiter if needed, but here we just want to split.
  // We'll split by "nueva tarea" or "otra tarea" case insensitive.
  
  const parts = input.split(/\s+(?:nueva|otra)\s+tarea\s+/i);
  
  const results: CommandResult[] = [];
  let currentId = startId;

  parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      
      const result = parseCommand(trimmed, currentId);
      results.push(result);
      
      // Only increment ID if we actually created a task
      if (result.action === 'create') {
          currentId++;
      }
  });

  return results;
}
