import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2, ArrowRightLeft, Pencil, CalendarIcon, ChevronRight } from "lucide-react";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from 'react';
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

export function TaskCard({ task, onComplete, onDelete, onUpdate }: TaskCardProps) {
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
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isEditingText, setIsEditingText] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const currentColumn = getColumnForTask(task);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-manipulation mb-3">
      <Card className="rounded-none border-t-0 border-x-0 border-b-1 shadow-none hover:bg-muted/30 transition-colors group" data-testid={`card-task-${task.id}`}>
        <CardContent className="p-3">

          {/* Header Line */}
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-2">
            <span className="flex items-center gap-2">
              #{task.id}
              {task.urgent && (
                <Badge variant="destructive" className="rounded-none text-[10px] h-4 px-1 uppercase tracking-tighter">
                  Urgente
                </Badge>
              )}
            </span>
            <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {/* Move column dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-none hover:bg-purple-100 hover:text-purple-700"
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
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Complete button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none hover:bg-green-100 hover:text-green-700"
                onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`btn-complete-${task.id}`}
              >
                <Check className="h-3 w-3" />
              </Button>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-none hover:bg-red-100 hover:text-red-700"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`btn-delete-${task.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Body - Editable text */}
          <div className="mb-2">
            {isEditingText ? (
              <input
                className="w-full bg-transparent border-b border-dashed border-gray-400 font-sans font-medium text-sm focus:outline-none"
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
                <Pencil className="inline-block w-3 h-3 ml-1.5 text-gray-300 md:opacity-0 md:group-hover/text:opacity-100 transition-opacity align-text-bottom" />
              </p>
            )}
          </div>

          {/* Footer Metadata: person + date + +1d */}
          <div className="flex items-center gap-2 mt-3 text-xs">

            {/* Person dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant="outline"
                  className="rounded-none border-gray-200 text-gray-500 font-normal px-1.5 h-5 cursor-pointer hover:border-gray-400 hover:text-gray-700 transition-colors"
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
                  key="none"
                  onClick={() => onUpdate(task.id, { person: '' })}
                  className="font-mono text-xs cursor-pointer text-gray-400 italic"
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
                    task.date === 'a definir' ? "text-gray-400 italic" : "text-gray-600"
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  data-testid={`text-date-${task.id}`}
                >
                  {task.date}
                  <CalendarIcon className="w-3 h-3 text-gray-300 md:opacity-0 md:group-hover/date:opacity-100 transition-opacity" />
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

            {/* +1 day button */}
            <button
              className="font-mono text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-1 rounded-none transition-colors flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100"
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
