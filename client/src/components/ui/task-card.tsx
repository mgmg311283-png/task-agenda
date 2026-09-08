import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2, ArrowRightLeft, Pencil, CalendarIcon, ChevronRight, GripVertical, Copy, Zap, Play, Square, AlertCircle, TrendingUp, Star, History } from "lucide-react";
import { TaskHistoryDialog } from "@/components/task-history-dialog";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseDateStr, formatDate, advanceDays, isOverdue, isToday } from "@/lib/date-utils";
import { useState, memo } from 'react';
import { useTimer, ElapsedLabel } from '@/lib/timer-context';
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { es } from "react-day-picker/locale";

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
  onDuplicate?: (task: Task) => void;
}







function getColumnForTask(task: Task): string {
  if (task.urgent) return 'urgent';
  if (task.type === 'para_pensar') return 'think';
  return 'action';
}

const MOVE_OPTIONS = [
  { id: 'urgent', label: 'URGENTE', icon: '🔴', updates: { urgent: true } },
  { id: 'action', label: 'ACCION', icon: '🔵', updates: { urgent: false, type: 'accion' as const } },
  { id: 'think', label: 'PENSAR', icon: '🟡', updates: { urgent: false, type: 'para_pensar' as const } },
];

interface AppUser {
  id: number;
  displayName: string;
  active: boolean;
}



function TaskCardImpl({ task, onComplete, onDelete, onUpdate, onDuplicate }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isDragging ? 0.5 : 1,
  };

  const [isEditingText, setIsEditingText] = useState(false);
  const [isEditingIntention, setIsEditingIntention] = useState(false);
  const [isEditingNextStep, setIsEditingNextStep] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { user } = useAuth();
  const { running, isBusy, toggle } = useTimer();
  const isRunning = running?.taskId === task.id;
  const isAdmin = user?.role === "admin";
  // Solo el admin puede reasignar tareas, y GET /api/users es admin-only en
  // el servidor — no tiene sentido dispararla para el resto.
  const { data: assignableUsers = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
    staleTime: 60_000,
  });
  const currentColumn = getColumnForTask(task);
  const overdue = isOverdue(task.date);
  const isTaskToday = isToday(task.date);

  const copyToClipboard = () => {
    const text = `[#${task.id}] ${task.text} — ${task.date} — ${task.person}`;
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: "Copiado", description: text, duration: 2000 }),
      () => toast({
        title: "No se pudo copiar",
        description: "El navegador bloqueó el acceso al portapapeles.",
        variant: "destructive",
      }),
    );
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-manipulation mb-3 animate-in fade-in duration-200">
      <Card
        className={cn(
          "rounded-none border-t-0 border-x-0 border-b shadow-none hover:bg-muted/30 transition-all group",
          overdue && "border-l-2 border-l-orange-400",
          isTaskToday && "border-l-2 border-l-green-500 bg-green-50/30 dark:bg-green-950/20 hover:shadow-md",
          isRunning && "ring-1 ring-green-500 bg-green-50/60 dark:bg-green-950/40"
        )}
        data-testid={`card-task-${task.id}`}
      >
        <CardContent className="p-3">

          {/* Header */}
          <div className="flex items-center gap-1 mb-2">

            <span
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none flex-shrink-0"
              data-testid={`drag-handle-${task.id}`}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>

            <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground flex-1 min-w-0">
              #{task.id}
              {task.priority === 'alta' && (
                <TrendingUp className="h-3.5 w-3.5 text-red-500 flex-shrink-0" aria-label="Alta prioridad" />
              )}
              {task.priority === 'baja' && (
                <TrendingUp className="h-3.5 w-3.5 text-blue-500 rotate-180 flex-shrink-0" aria-label="Baja prioridad" />
              )}
              {task.urgent && (
                <Badge
                  variant="destructive"
                  className="rounded-none text-[10px] h-4 px-1 uppercase tracking-tighter flex-shrink-0"
                >
                  Urgente
                </Badge>
              )}
              {overdue && !task.urgent && (
                <span className="text-[10px] text-orange-500 font-mono shrink-0">vencida</span>
              )}
            </span>

            {/* Action buttons */}
            <div className="flex gap-1 flex-shrink-0">

              {/* Star/favorite */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-none",
                  task.starred
                    ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900"
                    : "hover:bg-yellow-50 hover:text-yellow-500 md:opacity-0 md:group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(task.id, { starred: !task.starred });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title={task.starred ? "Desmarcar favorita" : "Marcar favorita"}
                aria-label={task.starred ? "Desmarcar favorita" : "Marcar favorita"}
              >
                <Star className={cn("h-3 w-3", task.starred && "fill-current")} />
              </Button>

              {/* Cronómetro: una sola tarea a la vez (lo impone el servidor) */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-none",
                  isRunning
                    ? "w-auto px-1.5 gap-1 text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
                    : "hover:bg-green-50 hover:text-green-600 md:opacity-0 md:group-hover:opacity-100"
                )}
                onClick={(e) => { e.stopPropagation(); toggle(task.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isBusy}
                title={isRunning ? "Detener cronómetro" : "Empezar a medir el tiempo"}
                aria-label={isRunning ? `Detener cronómetro de la tarea #${task.id}` : `Empezar a medir el tiempo de la tarea #${task.id}`}
                data-testid={`btn-timer-${task.id}`}
              >
                {isRunning ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3" />}
                {isRunning && (
                  <ElapsedLabel className="text-[10px] font-mono tabular-nums" />
                )}
              </Button>

              {/* Toggle urgente */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-none",
                  task.urgent
                    ? "text-orange-500 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950"
                    : "hover:bg-orange-50 hover:text-orange-500 md:opacity-0 md:group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(task.id, { urgent: !task.urgent });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title={task.urgent ? "Quitar urgente" : "Marcar urgente"}
                aria-label={task.urgent ? "Quitar urgente" : "Marcar urgente"}
                data-testid={`btn-urgent-${task.id}`}
              >
                <Zap className="h-3 w-3" />
              </Button>

              {/* Move column */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-none hover:bg-purple-100 hover:text-purple-700 md:opacity-0 md:group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-testid={`btn-move-${task.id}`}
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  {MOVE_OPTIONS.filter(opt => opt.id !== currentColumn).map(opt => (
                    <DropdownMenuItem
                      key={opt.id}
                      data-testid={`move-to-${opt.id}-${task.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(task.id, opt.updates);
                      }}
                      className="font-mono text-xs gap-2 cursor-pointer"
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}
                    className="font-mono text-xs gap-2 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" /> Copiar texto
                  </DropdownMenuItem>
                  {onDuplicate && (
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onDuplicate(task); }}
                      className="font-mono text-xs gap-2 cursor-pointer"
                    >
                      + Duplicar tarea
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Complete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900 dark:hover:text-green-300 transition-colors"
                onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`btn-complete-${task.id}`}
                title={`Completar: ${task.text}`}
                aria-label={`Completar tarea #${task.id}: ${task.text}`}
              >
                <Check className="h-3 w-3" />
              </Button>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none hover:bg-red-100 hover:text-red-700 md:opacity-0 md:group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.id);
                  toast({
                    title: `Tarea #${task.id} eliminada`,
                    description: "Ctrl+Z para deshacer.",
                    duration: 5000,
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`btn-delete-${task.id}`}
                title="Eliminar"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3 w-3" />
              </Button>

            </div>
          </div>

          {/* Editable text */}
          <div className="mb-2">
            {isEditingText ? (
              <input
                className="w-full bg-transparent border-b border-dashed border-muted-foreground font-sans font-medium text-sm focus:outline-none"
                defaultValue={task.text}
                autoFocus
                data-testid={`input-text-${task.id}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  setIsEditingText(false);
                  if (e.target.value.trim() && e.target.value !== task.text) {
                    onUpdate(task.id, { text: e.target.value.trim() });
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setIsEditingText(false);
                }}
              />
            ) : (
              <p
                className="font-sans font-medium text-sm leading-snug cursor-text group/text"
                onClick={(e) => { e.stopPropagation(); setIsEditingText(true); }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`text-task-${task.id}`}
              >
                {task.text}
                <Pencil className="inline-block w-3 h-3 ml-1.5 text-muted-foreground/30 opacity-0 group-hover/text:opacity-100 transition-opacity align-text-bottom" />
              </p>
            )}
          </div>

          {/* Intencion / proximo paso — ambos opcionales */}
          <div className="mb-2 space-y-1">
            {isEditingIntention ? (
              <input
                className="w-full bg-transparent border-b border-dashed border-muted-foreground font-sans text-xs focus:outline-none"
                defaultValue={task.intention || ''}
                placeholder="Intencion..."
                autoFocus
                data-testid={`input-intention-${task.id}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  setIsEditingIntention(false);
                  const value = e.target.value.trim();
                  if (value !== (task.intention || '')) {
                    onUpdate(task.id, { intention: value });
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setIsEditingIntention(false);
                }}
              />
            ) : (
              <p
                className={cn(
                  "font-sans text-xs leading-snug cursor-text group/intention",
                  task.intention ? "text-muted-foreground" : "text-muted-foreground/40 italic md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                )}
                onClick={(e) => { e.stopPropagation(); setIsEditingIntention(true); }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`text-intention-${task.id}`}
              >
                {task.intention || '+ agregar intención'}
                <Pencil className="inline-block w-3 h-3 ml-1.5 text-muted-foreground/30 opacity-0 group-hover/intention:opacity-100 transition-opacity align-text-bottom" />
              </p>
            )}

            {isEditingNextStep ? (
              <input
                className="w-full bg-transparent border-b border-dashed border-muted-foreground font-sans text-xs focus:outline-none"
                defaultValue={task.nextStep || ''}
                placeholder="Proximo paso..."
                autoFocus
                data-testid={`input-next-step-${task.id}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  setIsEditingNextStep(false);
                  const value = e.target.value.trim();
                  if (value !== (task.nextStep || '')) {
                    onUpdate(task.id, { nextStep: value });
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setIsEditingNextStep(false);
                }}
              />
            ) : (
              <p
                className={cn(
                  "font-sans text-xs leading-snug cursor-text group/nextstep",
                  task.nextStep ? "text-muted-foreground" : "text-muted-foreground/40 italic md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                )}
                onClick={(e) => { e.stopPropagation(); setIsEditingNextStep(true); }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`text-next-step-${task.id}`}
              >
                {task.nextStep || '+ agregar próximo paso'}
                <Pencil className="inline-block w-3 h-3 ml-1.5 text-muted-foreground/30 opacity-0 group-hover/nextstep:opacity-100 transition-opacity align-text-bottom" />
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">

            {/* Persona asignada. Solo el admin puede reasignar (el server
                también lo exige): para el resto es de solo lectura, porque
                antes esto era un campo de texto libre sin relación con los
                permisos reales — cambiarlo daba la falsa sensación de haber
                reasignado la tarea sin tocar quién puede verla de verdad. */}
            {isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge
                    variant="outline"
                    className="rounded-none border-border text-muted-foreground font-normal px-1.5 h-5 cursor-pointer hover:border-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-testid={`badge-person-${task.id}`}
                  >
                    {task.person || 'sin asignar'}
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="min-w-[160px]"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    onClick={() => onUpdate(task.id, { assignedUserId: null, person: 'a definir' })}
                    className="font-mono text-xs cursor-pointer text-muted-foreground italic"
                    data-testid={`person-none-${task.id}`}
                  >
                    sin asignar
                  </DropdownMenuItem>
                  {assignableUsers.filter((u) => u.active).map((u) => (
                    <DropdownMenuItem
                      key={u.id}
                      onClick={() => onUpdate(task.id, { assignedUserId: u.id, person: u.displayName })}
                      className={cn(
                        "font-mono text-xs cursor-pointer",
                        task.assignedUserId === u.id && "font-bold"
                      )}
                      data-testid={`person-${u.id}-${task.id}`}
                    >
                      {u.displayName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge
                variant="outline"
                className="rounded-none border-border text-muted-foreground font-normal px-1.5 h-5"
                data-testid={`badge-person-${task.id}`}
              >
                {task.person || 'sin asignar'}
              </Badge>
            )}

            {/* Date picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "font-mono tracking-tight text-xs flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors group/date",
                    task.date === 'a definir' ? "text-muted-foreground italic" :
                    isTaskToday ? "text-green-600 font-semibold" :
                    overdue ? "text-orange-500 font-semibold" : "text-muted-foreground"
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`text-date-${task.id}`}
                >
                  {task.date}
                  <CalendarIcon className="w-3 h-3 opacity-0 group-hover/date:opacity-100 transition-opacity" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                align="end"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <Calendar
                  mode="single"
                  locale={es}
                  selected={parseDateStr(task.date)}
                  defaultMonth={parseDateStr(task.date) || new Date()}
                  onSelect={(date) => {
                    if (date) {
                      onUpdate(task.id, { date: formatDate(date) });
                    }
                    setCalendarOpen(false);
                  }}
                  data-testid={`calendar-${task.id}`}
                />
              </PopoverContent>
            </Popover>

            {/* +1 day */}
            <button
              className="font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-1 rounded-none transition-colors flex items-center gap-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(task.id, { date: advanceDays(task.date, 1) });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Mover al día siguiente"
              aria-label="Mover al día siguiente"
              data-testid={`btn-plus1d-${task.id}`}
            >
              <ChevronRight className="w-3 h-3" />
              <span>1d</span>
            </button>

            {/* +7 days */}
            <button
              className="font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-1 rounded-none transition-colors flex items-center gap-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(task.id, { date: advanceDays(task.date, 7) });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Mover 7 días adelante"
              aria-label="Mover 7 días adelante"
              data-testid={`btn-plus7d-${task.id}`}
            >
              <ChevronRight className="w-3 h-3" />
              <span>7d</span>
            </button>

            {/* +14 days */}
            <button
              className="font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-1 rounded-none transition-colors flex items-center gap-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(task.id, { date: advanceDays(task.date, 14) });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Mover 14 días adelante"
              aria-label="Mover 14 días adelante"
              data-testid={`btn-plus14d-${task.id}`}
            >
              <ChevronRight className="w-3 h-3" />
              <span>14d</span>
            </button>

            {/* +30 days */}
            <button
              className="font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-1 rounded-none transition-colors flex items-center gap-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(task.id, { date: advanceDays(task.date, 30) });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Mover 30 días adelante"
              aria-label="Mover 30 días adelante"
              data-testid={`btn-plus30d-${task.id}`}
            >
              <ChevronRight className="w-3 h-3" />
              <span>30d</span>
            </button>

            {/* Historial */}
            <button
              className="font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-none transition-colors flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                setHistoryOpen(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Ver historial"
              aria-label="Ver historial"
              data-testid={`btn-history-${task.id}`}
            >
              <History className="w-3 h-3" />
            </button>

          </div>

        </CardContent>
      </Card>
      {historyOpen && (
        <TaskHistoryDialog taskId={task.id} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}

/**
 * Memoizado: el tablero re-renderiza en cada poll (5s) y en cada update
 * optimista. Sin esto, mover UNA tarea repinta todas las tarjetas visibles.
 * Se compara por los campos que la tarjeta realmente muestra.
 */
export const TaskCard = memo(TaskCardImpl, (prev, next) => {
  const a = prev.task;
  const b = next.task;
  return (
    a.id === b.id &&
    a.text === b.text &&
    a.date === b.date &&
    a.person === b.person &&
    a.type === b.type &&
    a.urgent === b.urgent &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.starred === b.starred &&
    a.assignedUserId === b.assignedUserId &&
    a.createdByUserId === b.createdByUserId &&
    a.updatedAt === b.updatedAt
  );
});
