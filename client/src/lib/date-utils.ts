/**
 * Helpers de fecha para tareas. Las fechas se guardan como texto "dd/MM/yy"
 * (o "dd/MM/yyyy"), o el literal "a definir".
 *
 * Estaban dentro de task-card.tsx sin exportar, lo que obligaba a duplicarlos
 * en cualquier vista nueva. Extraidos para reusarlos.
 */

export function parseDateStr(dateStr: string): Date | undefined {
  if (!dateStr || dateStr === "a definir") return undefined;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return undefined;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return undefined;
  if (year < 100) year += 2000;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? undefined : d;
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
}

/**
 * Suma dias a la fecha de una tarea. Si no tiene fecha valida, cuenta desde hoy.
 * Reemplaza a advanceOneDay/SevenDays/FourteenDays/ThirtyDays, que eran la
 * misma funcion repetida con distinto numero.
 */
export function advanceDays(dateStr: string, days: number): string {
  const base = parseDateStr(dateStr) || new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return formatDate(next);
}

export function isOverdue(dateStr: string): boolean {
  const d = parseDateStr(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function isToday(dateStr: string): boolean {
  const d = parseDateStr(dateStr);
  if (!d) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}
