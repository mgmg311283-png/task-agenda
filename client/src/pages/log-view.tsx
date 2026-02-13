import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useTasks } from "@/lib/task-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function LogView() {
  const { state } = useTasks();

  return (
    <div className="min-h-screen bg-white p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6 border-b pb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-mono">HISTORIAL DE CAMBIOS</h1>
      </div>

      <div className="space-y-4">
        {state.logs.length === 0 ? (
          <p className="text-gray-500 font-mono">No hay registros aún.</p>
        ) : (
          state.logs.map((log) => (
            <div key={log.id} className="border-l-2 border-gray-200 pl-4 py-2 hover:bg-gray-50 transition-colors font-mono text-sm">
              <div className="flex gap-2 text-gray-500 text-xs mb-1">
                <span>{format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}</span>
                <span>•</span>
                <span className="uppercase font-bold tracking-wider">{log.source}</span>
                <span>•</span>
                <span className="text-black font-bold">{log.action}</span>
              </div>
              <p className="text-gray-800">{log.details}</p>
              {log.newValues && (
                <div className="mt-1 text-xs text-gray-500 bg-gray-100 p-1 inline-block">
                    {JSON.stringify(log.newValues).substring(0, 100)}...
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
