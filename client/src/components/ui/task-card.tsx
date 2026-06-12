import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2, ArrowRightLeft, Pencil, CalendarIcon, ChevronRight, GripVertical, Copy, Zap, AlertCircle, TrendingUp, Star } from "lucide-react";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from 'react';
import { toast } from "@/hooks/use-toast";
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

function parseDateStr(dateStr: string): Date | undefined {
  if (!dateStr || dateStr === 'a definir') return undefined;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  return undefined;
}

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
}

function advanceOneDay(dateStr: string): string {
  const base = parseDateStr(dateStr);
  const from = base || new Date();
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  return formatDate(next);
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

const PERSONAS = ['mariano', 'aldana', 'Alejandro', 'Enzo', 'penso', 'Daniel', 'Carla', 'Cebrero', 'Marcos', 'Gonzalo'];

function isOverdue(dateStr: string): boolean {
  if (!dateStr || dateStr === 'a definir') return false;
  const d = parseDateStr(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isToday(dateStr: string): boolean {
  if (!dateStr || dateStr === 'a definir') return false;
  const d = parseDateStr(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
}

export function TaskCard({ task, onComplete, onDelete, onUpdate, onDuplicate }: TaskCardProps) {
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const currentColumn = getColumnForTask(task);
  const overdue = isOverdue(task.date);
  const isTaskToday = isToday(task.date);

  const copyToClipboard = () => {
    const text = `[#${task.id}] ${task.text} — ${task.date} — ${task.person}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copiado", description: text, duration: 2000 });
    });
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-manipulation mb-3 animate-in fade-in duration-200">
      <Card
        className={cn(
          "rounded-none border-t-0 border-x-0 border-b shadow-none hover:bg-muted/30 transition-all group",
          overdue && "border-l-2 border-l-orange-400",
          isTaskToday && "border-l-2 border-l-green-500 bg-green-50/30 dark:bg-green-950/20 hover:shadow-md"
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
                    : "hover:bg-yellow-50 hover:text-yellow-500 opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(task.id, { starred: !task.starred });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title={task.starred ? "Desmarcar favorita" : "Marcar favorita"}
              >
                <Star className={cn("h-3 w-3", task.starred && "fill-current")} />
              </Button>

              {/* Toggle urgente */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-none",
                  task.urgent
                    ? "text-orange-500 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950"
                    : "hover:bg-orange-50 hover:text-orange-500 opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(task.id, { urgent: !task.urgent });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title={task.urgent ? "Quitar urgente" : "Marcar urgente"}
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
                    className="h-6 w-6 rounded-none hover:bg-purple-100 hover:text-purple-700 opacity-0 group-hover:opacity-100"
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
                className="h-6 w-6 rounded-none hover:bg-red-100 hover:text-red-700 opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`btn-delete-${task.id}`}
                title="Eliminar"
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

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">

            {/* Person dropdown */}
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
                className="min-w-[140px]"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={() => onUpdate(task.id, { person: 'a definir' })}
                  className="font-mono text-xs cursor-pointer text-muted-foreground italic"
                  data-testid={`person-none-${task.id}`}
                >
                  sin asignar
                </DropdownMenuItem>
                {PERSONAS.map((persona) => (
                  <DropdownMenuItem
                    key={persona}
                    onClick={() => onUpdate(task.id, { person: persona })}
                    className={cn(
                      "font-mono text-xs cursor-pointer",
                      task.person === persona && "font-bold"
                    )}
                    data-testid={`person-${persona}-${task.id}`}
                  >
                    {persona}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "font-mono tracking-tight text-xs flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors group/date",
                    task.date === 'a definir' ? "text-muted-foreground italic" :
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
                onUpdate(task.id, { date: advanceOneDay(task.date) });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Mover al día siguiente"
              data-testid={`btn-plus1d-${task.id}`}
            >
              <ChevronRight className="w-3 h-3" />
              <span>1d</span>
            </button>

          </div>

        </CardContent>
      </Card>
    </div>
  );
}
