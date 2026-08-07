/**
 * Derivacion de la historia de una tarea a partir de los logs.
 *
 * `originalValues` / `newValues` guardan la Task completa serializada, asi que
 * el diff campo por campo se deriva sin cambiar el formato de escritura.
 * Vive en el servidor para que todas las vistas compartan la misma derivacion.
 */

const TRACKED = [
  "text", "date", "person", "assignedUserId", "type",
  "urgent", "status", "starred", "priority",
] as const;

export type TrackedField = (typeof TRACKED)[number];

export interface FieldChange {
  field: TrackedField;
  from: unknown;
  to: unknown;
  label: string;
}

function safeParse(raw: unknown): Record<string, any> | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

const TYPE_LABEL: Record<string, string> = {
  accion: "Acción",
  para_pensar: "Pensar",
  a_definir: "A definir",
};

/** Texto en castellano para un cambio puntual. */
export function describeChange(c: { field: string; from: any; to: any }): string {
  switch (c.field) {
    case "date":
      if (c.from === "a definir" || c.from == null) return `Se le puso fecha: ${c.to}`;
      if (c.to === "a definir") return `Se le sacó la fecha (era ${c.from})`;
      return `Pasó de fecha: ${c.from} → ${c.to}`;
    case "status":
      if (c.to === "completada") return "Se completó";
      if (c.to === "eliminada") return "Se eliminó";
      if (c.from === "completada" && c.to === "activa") return "Se reabrió";
      if (c.from === "eliminada" && c.to === "activa") return "Se restauró";
      return `Estado: ${c.from} → ${c.to}`;
    case "urgent":
      return c.to ? "Se marcó como urgente" : "Se sacó de urgente";
    case "starred":
      return c.to ? "Se marcó como favorita" : "Se sacó de favoritas";
    case "type":
      return `Movida a ${TYPE_LABEL[String(c.to)] || c.to}`;
    case "person":
      return `Asignada a ${c.to || "sin asignar"}`;
    case "assignedUserId":
      return c.to == null ? "Quedó sin asignar" : "Se reasignó";
    case "priority":
      return `Prioridad: ${c.from ?? "normal"} → ${c.to ?? "normal"}`;
    case "text":
      return "Se editó el texto";
    default:
      return `${c.field}: ${c.from} → ${c.to}`;
  }
}

/** Cambios entre el antes y el despues de un log. */
export function diffLog(log: {
  originalValues?: unknown;
  newValues?: unknown;
}): FieldChange[] {
  const before = safeParse(log.originalValues);
  const after = safeParse(log.newValues);
  if (!after) return [];

  const out: FieldChange[] = [];
  for (const field of TRACKED) {
    if (!(field in after)) continue;
    const to = (after as any)[field];
    const from = before ? (before as any)[field] : undefined;
    // Sin `before` (ej. CREATE) solo reportamos lo que tenga valor util.
    if (before) {
      if (from === to) continue;
    } else if (to == null || to === "" || to === false) {
      continue;
    }
    out.push({ field, from: from ?? null, to, label: describeChange({ field, from, to }) });
  }
  return out;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Creada",
  UPDATE: "Modificada",
  COMPLETE: "Completada",
  DELETE: "Eliminada",
  MOVE_EXPIRED: "Movida por vencimiento",
  MOVE_URGENT_TO_ACTION: "Urgente → Acción",
  DELETE_ALL: "Borrado masivo",
  IMPORT: "Importada",
};

export function describeAction(action: string): string {
  return ACTION_LABEL[action] || action;
}
