import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Trash, CalendarClock, History, BarChart3, Moon, Sun, AlertTriangle, RotateCcw, RotateCw, Plus, Settings, Zap, Wifi, Presentation, Focus, Users, LogOut } from "lucide-react";
import { useTasks } from "@/lib/task-context";
import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import Papa from 'papaparse';
import { toast } from "@/hooks/use-toast";
import { Task, TaskStatus } from "@/lib/types";
import { isTaskOverdue } from "@/lib/parser";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useTimer, ElapsedLabel } from "@/lib/timer-context";
import { useQuickTasks } from "@/lib/quick-tasks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export function TopBar() {
  const { state, dispatch, moveExpiredAsync, moveUrgentToActionAsync, importAsync, undo, redo, canUndo, canRedo } = useTasks();
  const { running, isBusy, toggle } = useTimer();
  // Los atajos de la barra rapida no viven en state.tasks (se excluyen del
  // tablero a proposito), asi que sin este fallback el indicador de "corriendo"
  // mostraba "#429" en vez de "Contestar mails".
  const { data: atajos = [] } = useQuickTasks();
  const runningLabel = running
    ? (state.tasks.find(t => t.id === running.taskId)?.text
       ?? atajos.find(a => a.id === running.taskId)?.text)
    : undefined;
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const [csvContent, setCsvContent] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  // navigator.onLine solo mira la placa de red: con wifi conectado pero el
  // servidor caido decia "Sync" igual. Ahora tambien pesa si la query de
  // tareas esta fallando o refrescando.
  const syncStatus: 'synced' | 'syncing' | 'offline' =
    !isBrowserOnline || state.hasError ? 'offline'
    : state.isFetching ? 'syncing'
    : 'synced';
  const [focusMode, setFocusMode] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsBrowserOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleExport = () => {
    const activeTasks = state.tasks.filter(t => t.status === 'activa');
    const csvData = activeTasks.map(t => ({
        FECHA: t.date,
        NUMERO: t.id,
        TAREA: t.text,
        PERSONA: t.person,
        TIPO: t.type,
        URGENTE: t.urgent ? 'urgente' : '',
        PRIORIDAD: t.priority || 'normal'
    }));
    const csv = Papa.unparse(csvData);
    // BOM: sin esto Excel abre el CSV en la codificacion del sistema y rompe
    // todos los acentos y las ñ (que en esta app hay en casi todas las tareas).
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // toISOString() trae ':' y '.', que Windows no acepta en nombres de
    // archivo: el navegador terminaba renombrandolo solo.
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    link.setAttribute('download', `agenda_export_${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // El object URL quedaba vivo hasta recargar la pagina.
    URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${activeTasks.length} tareas exportadas a CSV` });
  };

  const handlePasteImport = () => {
    if (!csvContent.trim()) return;
    const csvWithHeaders = csvContent.trim().toUpperCase().startsWith("FECHA") ? csvContent : "FECHA,TAREA,PERSONA,TIPO,URGENTE\n" + csvContent; Papa.parse(csvWithHeaders, {
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
                    id: 0,
                    date: row.FECHA || 'a definir',
                    // Sin fallback: el .filter(t => t.text) de abajo nunca
                    // filtraba nada porque 'Sin título' siempre era truthy, asi
                    // que una fila vacia (",,,,") entraba como tarea fantasma.
                    text: (row.TAREA || '').trim(),
                    person: row.PERSONA || 'a definir',
                    type,
                    urgent: row.URGENTE === 'urgente',
                    status: 'activa' as TaskStatus,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }).filter((t: any) => t.text);

            if (tasks.length > 0) {
                setIsImportOpen(false);
                setCsvContent("");
                importAsync(tasks, 'Import')
                  .then((created) => toast({
                    title: "Importación exitosa",
                    description: `${created.length} tareas agregadas`,
                  }))
                  .catch((e) => toast({
                    variant: "destructive",
                    title: "Falló la importación",
                    description: e instanceof Error ? e.message : 'Error desconocido',
                  }));
            } else {
                toast({ variant: "destructive", title: "Error", description: "No se encontraron tareas válidas." });
            }
        },
        error: (err: any) => {
             toast({ variant: "destructive", title: "Error al parsear", description: err.message });
        }
    });
  };

  const overdueCount = useMemo(
    () => state.tasks.filter(t => t.status === 'activa' && isTaskOverdue(t.date)).length,
    [state.tasks]
  );

  const urgentCount = useMemo(
    () => state.tasks.filter(t => t.status === 'activa' && t.urgent === true).length,
    [state.tasks]
  );

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const completedToday = useMemo(
    () => state.allTasks.filter(t => {
      if (t.status !== 'completada') return false;
      try {
        return t.updatedAt.startsWith(todayStr);
      } catch {
        return false;
      }
    }).length,
    [state.allTasks, todayStr]
  );

  const totalActive = state.tasks.filter(t => t.status === 'activa').length;
  const progressPct = totalActive + completedToday > 0
    ? Math.round((completedToday / (totalActive + completedToday)) * 100)
    : 0;

  // Activity indicators
  const recentlyModified = useMemo(() => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
    return state.tasks.filter(t =>
      new Date(t.updatedAt) > fiveMinutesAgo && t.status === 'activa'
    ).length;
  }, [state.tasks]);

  const navLinks = [
    { href: '/', label: 'TABLERO' },
    { href: '/log', label: 'HISTORIAL', icon: <History className="w-3 h-3" /> },
    { href: '/metrics', label: 'REPORTES', icon: <BarChart3 className="w-3 h-3" /> },
    // Solo el admin gestiona usuarios; la ruta también está protegida en el
    // servidor (403 para el resto), esto es solo para no mostrar un link roto.
    ...(isAdmin ? [{ href: '/usuarios', label: 'USUARIOS', icon: <Users className="w-3 h-3" /> }] : []),
  ];

  return (
    <header className="border-b border-border bg-background sticky top-0 z-50 shadow-sm">
      {/* Progress bar */}
      {progressPct > 0 && (
        <div className="h-0.5 bg-muted w-full">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg tracking-tight">FOCUS<span className="font-mono text-primary/50 text-xs ml-1">v1.0</span></h1>
            {completedToday > 0 && (
              <span className="text-[10px] font-mono bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">
                +{completedToday} hoy
              </span>
            )}
            {recentlyModified > 0 && (
              <span className="text-[10px] font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full animate-pulse">
                🔄 {recentlyModified}
              </span>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-4 border-l pl-4 h-6">
            {navLinks.map(({ href, label, icon }) => (
              <Link key={href} href={href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs rounded-none font-medium flex items-center gap-1 ${
                    location === href
                      ? 'text-black dark:text-white font-bold bg-muted'
                      : 'text-gray-500 hover:text-black dark:hover:text-white hover:bg-muted'
                  }`}
                >
                  {icon}
                  {label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          {overdueCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300"
              onClick={async () => {
                try {
                  const result = await moveExpiredAsync('UI');
                  if (result.moved > 0) {
                    toast({ title: "Vencidas actualizadas", description: `${result.moved} tarea(s) movidas a hoy (${result.date}).` });
                  } else {
                    toast({ title: "Sin cambios", description: "No hay tareas vencidas." });
                  }
                } catch {
                  toast({ variant: "destructive", title: "Error", description: "No se pudieron mover las tareas." });
                }
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              <span className="hidden sm:inline">Vencidas</span>
              <span className="font-bold">{overdueCount}</span>
            </Button>
          )}

          {overdueCount === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs hidden sm:flex gap-1 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
              onClick={async () => {
                try {
                  const result = await moveExpiredAsync('UI');
                  if (result.moved > 0) {
                    toast({ title: "Vencidas actualizadas", description: `${result.moved} tarea(s) movidas a hoy (${result.date}).` });
                  } else {
                    toast({ title: "Sin cambios", description: "No hay tareas vencidas para mover." });
                  }
                } catch {
                  toast({ variant: "destructive", title: "Error", description: "No se pudieron mover las tareas." });
                }
              }}
            >
              <CalendarClock className="w-3 h-3" /> Vencidas a Hoy
            </Button>
          )}

          {urgentCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              onClick={async () => {
                try {
                  const result = await moveUrgentToActionAsync('UI');
                  if (result.moved > 0) {
                    toast({ title: "Urgentes movidas", description: `${result.moved} tarea(s) movidas a ACCION.` });
                  } else {
                    toast({ title: "Sin cambios", description: "No hay tareas urgentes." });
                  }
                } catch {
                  toast({ variant: "destructive", title: "Error", description: "No se pudieron mover las tareas." });
                }
              }}
            >
              <Zap className="w-3 h-3" />
              <span className="hidden sm:inline">Urgentes → Acción</span>
              <span className="font-bold">{urgentCount}</span>
            </Button>
          )}

          {/* Cronómetro en curso: la tarjeta activa puede estar scrolleada
              fuera de pantalla o en otra columna, así que el estado tiene que
              verse siempre desde acá. */}
          {running && (
            <button
              onClick={() => toggle(running.taskId)}
              disabled={isBusy}
              className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border border-green-500/40 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 transition-colors max-w-[220px]"
              title={runningLabel ? `Detener: ${runningLabel}` : 'Detener cronómetro'}
              aria-label="Detener el cronómetro en curso"
              data-testid="btn-timer-running"
            >
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
              <ElapsedLabel className="tabular-nums font-bold shrink-0" />
              <span className="truncate opacity-80">
                {runningLabel ?? `#${running.taskId}`}
              </span>
            </button>
          )}

          {/* Sync status indicator */}
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
            title={
              syncStatus === 'offline'
                ? (isBrowserOnline ? 'No se puede contactar al servidor' : 'Sin conexión')
                : syncStatus === 'syncing' ? 'Actualizando...' : 'Sincronizado'
            }
            aria-live="polite"
          >
            {syncStatus === 'offline' ? (
              <>
                <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
                {isBrowserOnline ? 'Sin servidor' : 'Offline'}
              </>
            ) : (
              <>
                <span className={cn(
                  "inline-block w-2 h-2 rounded-full mr-1",
                  syncStatus === 'syncing' ? "bg-yellow-500 animate-pulse" : "bg-green-500",
                )}></span>
                Sync
              </>
            )}
          </span>

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Y)"
          >
            <RotateCw className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport} title="Exportar CSV">
            <Download className="w-4 h-4" />
          </Button>

          {/* Import masivo: disponible para todos los roles logueados. Un
              no-admin importa solo para si mismo — el servidor fuerza
              person/assignedUserId a su propio usuario, ignorando lo que
              venga en la columna PERSONA del CSV (mismo criterio que crear
              una tarea suelta). */}
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Importar (Pegar CSV)">
                <Upload className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Importar Tareas (CSV)</DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>Pegá tus tareas desde Excel o Sheets. Columnas esperadas:</p>
                  <div className="bg-muted p-2 rounded text-xs font-mono border border-border">
                    FECHA, TAREA, PERSONA, TIPO, URGENTE
                  </div>
                  <ul className="text-xs list-disc list-inside text-muted-foreground">
                    <li><strong>FECHA:</strong> dd/mm/yy o "a definir"</li>
                    <li><strong>TIPO:</strong> "accion", "pensar" o "a definir"</li>
                    <li><strong>URGENTE:</strong> "urgente" o vacío</li>
                  </ul>
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Textarea
                  placeholder={`Ejemplo:\n\n12/03/24, Comprar pan, Mariano, accion,\n, Llamar proveedor, Aldana, accion, urgente`}
                  className="h-[200px] font-mono text-xs"
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                />
              </div>
              <DialogFooter className="sm:justify-between">
                <Button type="button" variant="secondary" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
                <Button type="button" onClick={handlePasteImport} disabled={!csvContent.trim()}>Importar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", focusMode && "bg-primary/20 text-primary")}
            title="Modo Focus (ocultar distracciones)"
            onClick={() => setFocusMode(!focusMode)}
          >
            <Focus className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", presentationMode && "bg-primary/20 text-primary")}
            title="Modo Presentación"
            onClick={() => setPresentationMode(!presentationMode)}
          >
            <Presentation className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* Borrado masivo: solo admin (el servidor lo rechaza para el
              resto). Para un operario/supervisor esto borraría potencialmente
              tareas de otros equipos si no se restringiera). */}
          {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            title="Eliminar todas las activas"
            onClick={() => {
              if (confirm("¿Seguro que quieres eliminar TODAS las tareas activas?")) {
                dispatch({ type: 'DELETE_ALL_ACTIVE', source: 'UI' });
              }
            }}
          >
            <Trash className="w-4 h-4" />
          </Button>
          )}

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          <span className="text-xs text-muted-foreground hidden sm:inline" data-testid="text-current-user">
            {user?.displayName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Salir"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex md:hidden border-t border-border">
        {navLinks.map(({ href, label, icon }) => (
          <Link key={href} href={href} className="flex-1">
            <button
              className={`w-full py-2 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1 ${
                location === href ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-400'
              }`}
            >
              {icon}
              {label}
            </button>
          </Link>
        ))}
      </div>
    </header>
  );
}
