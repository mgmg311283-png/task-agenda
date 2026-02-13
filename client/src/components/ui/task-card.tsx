import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2, ArrowRightLeft, Pencil } from "lucide-react";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
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
  const [isEditingDate, setIsEditingDate] = useState(false);
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
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') { setIsEditingText(false); }
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

          {/* Footer Metadata */}
          <div className="flex items-center justify-between mt-3 text-xs">
             <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-none border-gray-200 text-gray-500 font-normal px-1.5 h-5">
                    {task.person}
                </Badge>
             </div>
             {isEditingDate ? (
                <input
                    className="font-mono tracking-tight text-xs bg-transparent border-b border-dashed border-gray-400 focus:outline-none w-24 text-right"
                    defaultValue={task.date}
                    autoFocus
                    placeholder="dd/mm/yy"
                    data-testid={`input-date-${task.id}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                        setIsEditingDate(false);
                        const val = e.target.value.trim();
                        if (val && val !== task.date) {
                            onUpdate(task.id, { date: val });
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') { setIsEditingDate(false); }
                    }}
                />
             ) : (
                <span
                    className={cn(
                        "font-mono tracking-tight cursor-text group/date",
                        task.date === 'a definir' ? "text-gray-400 italic" : "text-gray-600"
                    )}
                    onClick={(e) => { e.stopPropagation(); setIsEditingDate(true); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-testid={`text-date-${task.id}`}
                >
                    {task.date}
                    <Pencil className="inline-block w-2.5 h-2.5 ml-1 text-gray-300 md:opacity-0 md:group-hover/date:opacity-100 transition-opacity align-text-bottom" />
                </span>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
