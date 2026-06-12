import { ChatInterface } from "@/components/chat-interface";
import { KanbanBoard } from "@/components/kanban-board";
import { TopBar } from "@/components/top-bar";
import { useTasks } from "@/lib/task-context";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

export function Dashboard() {
  const { undo, redo, dispatch } = useTasks();
  const [showKbShortcuts, setShowKbShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';

      // Ctrl+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Y / Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Ctrl+N = New task
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !isInput) {
        e.preventDefault();
        dispatch({
          type: 'ADD_TASK',
          payload: {
            text: 'Nueva tarea',
            date: 'a definir',
            person: 'a definir',
            type: 'a_definir',
            urgent: false,
            status: 'activa'
          },
          source: 'UI'
        });
        toast({ title: "Nueva tarea creada", description: "Presiona / para editar" });
      }

      // Ctrl+Shift+? = Show shortcuts
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '?') {
        e.preventDefault();
        setShowKbShortcuts(!showKbShortcuts);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, dispatch]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <TopBar />
      <main className="flex-1 overflow-hidden relative">
        <KanbanBoard />
      </main>
      <ChatInterface />

      {/* Keyboard shortcuts modal */}
      {showKbShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowKbShortcuts(false)}
        >
          <div
            className="bg-background border border-border rounded-lg p-6 max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">⌨️ Atajos de Teclado</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-mono text-primary">Ctrl+Z</span>
                <span className="text-muted-foreground">Deshacer</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-primary">Ctrl+Y</span>
                <span className="text-muted-foreground">Rehacer</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-primary">Ctrl+N</span>
                <span className="text-muted-foreground">Nueva tarea</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-primary">/</span>
                <span className="text-muted-foreground">Enfocar chat</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-primary">Esc</span>
                <span className="text-muted-foreground">Salir del chat</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-primary">Ctrl+Shift+?</span>
                <span className="text-muted-foreground">Mostrar atajos</span>
              </div>
            </div>
            <button
              onClick={() => setShowKbShortcuts(false)}
              className="mt-6 w-full py-2 px-4 bg-primary text-primary-foreground rounded-none text-sm font-mono"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
