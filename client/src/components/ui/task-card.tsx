import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Trash2, AlertCircle, Brain, Zap } from "lucide-react";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
}

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

  const [isEditing, setIsEditing] = useState(false);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-manipulation mb-3">
      <Card className="rounded-none border-t-0 border-x-0 border-b-1 shadow-none hover:bg-muted/30 transition-colors group">
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
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-none hover:bg-green-100 hover:text-green-700"
                onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-none hover:bg-red-100 hover:text-red-700"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="mb-2">
             {isEditing ? (
                 <input 
                    className="w-full bg-transparent border-b border-dashed border-gray-400 font-sans font-medium text-sm focus:outline-none"
                    defaultValue={task.text}
                    autoFocus
                    onBlur={(e) => {
                        setIsEditing(false);
                        if (e.target.value !== task.text) {
                            onUpdate(task.id, { text: e.target.value });
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                 />
             ) : (
                <p 
                    className="font-sans font-medium text-sm leading-snug cursor-text"
                    onClick={() => setIsEditing(true)}
                >
                    {task.text}
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
             <span className={cn(
                 "font-mono tracking-tight",
                 task.date === 'a definir' ? "text-gray-400 italic" : "text-gray-600"
             )}>
                {task.date}
             </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
