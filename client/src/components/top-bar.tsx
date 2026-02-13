import { Button } from "@/components/ui/button";
import { Download, Upload, Trash, CalendarClock, History, BarChart3 } from "lucide-react";
import { useTasks } from "@/lib/task-context";
import { Link } from "wouter";
import Papa from 'papaparse';
import { toast } from "@/hooks/use-toast";
import { Task, TaskStatus } from "@/lib/types";

export function TopBar() {
  const { state, dispatch } = useTasks();

  const handleExport = () => {
    // FECHA,NUMERO,TAREA,PERSONA,TIPO,URGENTE
    const activeTasks = state.tasks.filter(t => t.status === 'activa');
    const csvData = activeTasks.map(t => ({
        FECHA: t.date,
        NUMERO: t.id,
        TAREA: t.text,
        PERSONA: t.person,
        TIPO: t.type,
        URGENTE: t.urgent ? 'urgente' : ''
    }));
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agenda_export_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        complete: (results) => {
            const tasks: Task[] = results.data.map((row: any) => ({
                id: 0, // Will be overwritten by reducer
                date: row.FECHA || 'a definir',
                text: row.TAREA || 'Sin título',
                person: row.PERSONA || 'a definir',
                type: (['accion', 'para_pensar'].includes(row.TIPO) ? row.TIPO : 'a_definir') as any,
                urgent: row.URGENTE === 'urgente',
                status: 'activa' as TaskStatus,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })).filter((t: any) => t.text); // Filter empty rows

            dispatch({ type: 'IMPORT_CSV', payload: tasks, source: 'Import' });
            toast({ title: "Importación exitosa", description: `${tasks.length} tareas agregadas` });
        }
    });
  };

  return (
    <header className="border-b border-border bg-white px-4 py-2 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg tracking-tight">FOCUS<span className="font-mono text-primary/50 text-xs ml-1">v1.0</span></h1>
            
            <nav className="hidden md:flex items-center gap-1 ml-4 border-l pl-4 h-6">
                <Link href="/">
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-none font-medium text-gray-500 hover:text-black hover:bg-gray-100">TABLERO</Button>
                </Link>
                <Link href="/log">
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-none font-medium text-gray-500 hover:text-black hover:bg-gray-100">
                        <History className="w-3 h-3 mr-1" /> HISTORIAL
                    </Button>
                </Link>
                <Link href="/metrics">
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-none font-medium text-gray-500 hover:text-black hover:bg-gray-100">
                        <BarChart3 className="w-3 h-3 mr-1" /> REPORTES
                    </Button>
                </Link>
            </nav>
        </div>

        <div className="flex items-center gap-1">
            <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs hidden sm:flex gap-1 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800" 
                onClick={() => {
                    dispatch({ type: 'MOVE_EXPIRED', source: 'UI' });
                    toast({ title: "Vencidas Actualizadas", description: "Se han movido las tareas vencidas a hoy." });
                }}
            >
                <CalendarClock className="w-3 h-3" /> Vencidas a Hoy
            </Button>
            
            <div className="h-4 w-px bg-border mx-1 hidden sm:block"></div>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport} title="Exportar CSV">
                <Download className="w-4 h-4" />
            </Button>
            
            <div className="relative">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Importar CSV">
                    <Upload className="w-4 h-4" />
                </Button>
                <input 
                    type="file" 
                    accept=".csv" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleImport}
                />
            </div>
            
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" title="Eliminar todas activas" onClick={() => {
                if(confirm("¿Seguro que quieres eliminar TODAS las tareas activas?")) {
                    dispatch({ type: 'DELETE_ALL_ACTIVE', source: 'UI' });
                }
            }}>
                <Trash className="w-4 h-4" />
            </Button>
        </div>
    </header>
  );
}
