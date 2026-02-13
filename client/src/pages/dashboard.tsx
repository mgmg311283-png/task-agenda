import { ChatInterface } from "@/components/chat-interface";
import { KanbanBoard } from "@/components/kanban-board";
import { TopBar } from "@/components/top-bar";

export function Dashboard() {
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
