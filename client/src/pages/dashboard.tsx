import { ChatInterface } from "@/components/chat-interface";
import { KanbanBoard } from "@/components/kanban-board";
import { TopBar } from "@/components/top-bar";
import { useTasks } from "@/lib/task-context";
import { useEffect } from "react";

export function Dashboard() {
  const { undo, redo } = useTasks();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <TopBar />
      <main className="flex-1 overflow-hidden relative">
        <KanbanBoard />
      </main>
      <ChatInterface />
    </div>
  );
}
