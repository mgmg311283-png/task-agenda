import { Button } from "@/components/ui/button";
import { Download, Upload, Trash, CalendarClock, History, BarChart3, X } from "lucide-react";
import { useTasks } from "@/lib/task-context";
import { Link } from "wouter";
import Papa from 'papaparse';
import { toast } from "@/hooks/use-toast";
import { Task, TaskStatus } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export function TopBar() {
  const { state, dispatch } = useTasks();
  const [csvContent, setCsvContent] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);

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

  const handlePasteImport = () => {
    if (!csvContent.trim()) return;

    Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const tasks: Task[] = results.data.map((row: any) => {
                let type: any = 'a_definir';
                const rowType = row.TIPO ? row.TIPO.toLowerCase().trim() : '';
                
                if (rowType === 'accion' || rowType === 'acción') type = 'accion';
                else if (rowType === 'para_pensar' || rowType === 'para pensar' || rowType === 'pensar') type = 'para_pensar';
                else if (rowType === 'a_definir' || rowType === 'a definir') type = 'a_definir';

                return {
                    id: 0, // Will be overwritten by reducer
                    date: row.FECHA || 'a definir',
                    text: row.TAREA || 'Sin título',
                    person: row.PERSONA || 'a definir',
                    type: type,
                    urgent: row.URGENTE === 'urgente',
                    status: 'activa' as TaskStatus,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }).filter((t: any) => t.text); // Filter empty rows

            if (tasks.length > 0) {
                dispatch({ type: 'IMPORT_CSV', payload: tasks, source: 'Import' });
                toast({ title: "Importación exitosa", description: `${tasks.length} tareas agregadas` });
                setIsImportOpen(false);
                setCsvContent("");
            } else {
                toast({ variant: "destructive", title: "Error", description: "No se encontraron tareas válidas en el texto pegado." });
            }
        },
        error: (err: any) => {
             toast({ variant: "destructive", title: "Error al parsear", description: err.message });
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
            
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Importar (Pegar CSV)">
                        <Upload className="w-4 h-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Importar Tareas (CSV)</DialogTitle>
                        <DialogDescription>
                            Pega el contenido de tu CSV aquí. Asegúrate de incluir los encabezados: FECHA, TAREA, PERSONA, TIPO, URGENTE.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea 
                            placeholder={`FECHA,NUMERO,TAREA,PERSONA,TIPO,URGENTE\n12/03/24,,Comprar pan,Mariano,accion,`}
                            className="h-[200px] font-mono text-xs"
                            value={csvContent}
                            onChange={(e) => setCsvContent(e.target.value)}
                        />
                    </div>
                    <DialogFooter className="sm:justify-between">
                         <Button type="button" variant="secondary" onClick={() => setIsImportOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handlePasteImport} disabled={!csvContent.trim()}>
                            Importar Tareas
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
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
