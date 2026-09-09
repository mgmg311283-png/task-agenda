import React, { useState } from 'react';
import {
  Mail, MessageCircle, Zap, Bot, Mic, Terminal, Users, Settings,
  AlertCircle, TrendingUp, CalendarClock, History, Star,
  Play, Square, Pencil, Plus, Trash2, Check,
  type LucideIcon,
} from 'lucide-react';
import { useTimer, useElapsed, formatElapsed } from '@/lib/timer-context';
import { useQuickTasks, useQuickTaskAdmin, type QuickTask } from '@/lib/quick-tasks';
import { useAuth } from '@/lib/auth-context';
import { QUICK_TASK_ICON_NAMES, type QuickTaskIconName } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Icono por nombre guardado en la fila (columna `icon`). El fallback (Zap)
// cubre atajos viejos sin icono asignado y cualquier nombre que ya no este
// en QUICK_TASK_ICON_NAMES.
const ICON_MAP: Record<QuickTaskIconName, LucideIcon> = {
  Mail, MessageCircle, Zap, Bot, Mic, Terminal, Users, Settings,
  AlertCircle, TrendingUp, CalendarClock, History, Star,
};

function iconoDe(nombre: string | null): LucideIcon {
  return (nombre && ICON_MAP[nombre as QuickTaskIconName]) || Zap;
}

/**
 * Total del dia para UN atajo. Aislado en su propio componente a proposito:
 * useElapsed cambia una vez por segundo, y si se leyera en la barra entera
 * los tres botones se re-renderizarian cada segundo. Asi solo late el numero
 * del que esta corriendo.
 */
function TotalDeHoy({ base, corriendo }: { base: number; corriendo: boolean }) {
  const elapsed = useElapsed();
  return (
    <span className="tabular-nums">
      {formatElapsed(base + (corriendo ? elapsed : 0))}
    </span>
  );
}

function BotonAtajo({ tarea }: { tarea: QuickTask }) {
  const { running, isBusy, toggle } = useTimer();
  const corriendo = running?.taskId === tarea.id;
  const Icono = iconoDe(tarea.icon);

  return (
    <button
      type="button"
      onClick={() => toggle(tarea.id)}
      disabled={isBusy}
      aria-pressed={corriendo}
      title={corriendo ? `Detener: ${tarea.text}` : `Empezar: ${tarea.text}`}
      data-testid={`btn-atajo-${tarea.quickSlot}`}
      className={cn(
        'flex items-center gap-2 shrink-0 px-2.5 py-1 border text-[11px] font-mono uppercase tracking-wide',
        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        corriendo
          ? 'border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
    >
      {corriendo
        ? <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
        : <Icono className="w-3.5 h-3.5 shrink-0 opacity-70" />}
      <span className="truncate max-w-[130px]">{tarea.text}</span>
      <span className={cn('shrink-0 font-bold', !corriendo && 'text-muted-foreground')}>
        <TotalDeHoy base={tarea.todaySeconds} corriendo={corriendo} />
      </span>
      {corriendo
        ? <Square className="w-3 h-3 shrink-0" />
        : <Play className="w-3 h-3 shrink-0 opacity-50" />}
    </button>
  );
}

function SelectorDeIcono({ value, onChange }: { value: QuickTaskIconName; onChange: (v: QuickTaskIconName) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icono">
      {QUICK_TASK_ICON_NAMES.map((nombre) => {
        const Icono = ICON_MAP[nombre];
        const activo = nombre === value;
        return (
          <button
            key={nombre}
            type="button"
            role="radio"
            aria-checked={activo}
            title={nombre}
            onClick={() => onChange(nombre)}
            className={cn(
              'flex items-center justify-center w-8 h-8 border transition-colors',
              activo
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            <Icono className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

/** Fila de un atajo existente: texto e icono editables, con baja confirmada. */
function FilaAtajo({ tarea }: { tarea: QuickTask }) {
  const { update, deactivate } = useQuickTaskAdmin();
  const [text, setText] = useState(tarea.text);
  const [icon, setIcon] = useState<QuickTaskIconName>(tarea.icon ?? 'Zap');
  const [confirmarBaja, setConfirmarBaja] = useState(false);

  const cambiado = text.trim() !== tarea.text || icon !== tarea.icon;

  const guardar = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'El texto no puede quedar vacío' });
      return;
    }
    update.mutate(
      { id: tarea.id, text: trimmed, icon },
      {
        onSuccess: () => toast({ title: 'Atajo actualizado' }),
        onError: (e: any) => toast({
          variant: 'destructive', title: 'No se pudo guardar',
          description: e instanceof Error ? e.message : 'Error desconocido',
        }),
      },
    );
  };

  return (
    <div className="border border-border p-3 space-y-2" data-testid={`row-atajo-${tarea.id}`}>
      <div className="flex items-center gap-2">
        <Input
          value={text}
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nombre del atajo"
          data-testid={`input-atajo-text-${tarea.id}`}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          title="Eliminar atajo"
          onClick={() => setConfirmarBaja(true)}
          data-testid={`button-delete-atajo-${tarea.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <SelectorDeIcono value={icon} onChange={setIcon} />

      {cambiado && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-1"
            onClick={guardar}
            disabled={update.isPending}
            data-testid={`button-save-atajo-${tarea.id}`}
          >
            <Check className="w-3.5 h-3.5" /> Guardar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setText(tarea.text); setIcon(tarea.icon ?? 'Zap'); }}
          >
            Cancelar
          </Button>
        </div>
      )}

      <AlertDialog open={confirmarBaja} onOpenChange={setConfirmarBaja}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{tarea.text}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en la barra y no se puede seguir cronometrando en él. El
              tiempo ya registrado en su historial y en los reportes de Métricas no se pierde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deactivate.mutate(tarea.id, {
                  onSuccess: () => toast({ title: 'Atajo eliminado' }),
                  onError: (e: any) => toast({
                    variant: 'destructive', title: 'No se pudo eliminar',
                    description: e instanceof Error ? e.message : 'Error desconocido',
                  }),
                });
              }}
              data-testid={`button-confirm-delete-atajo-${tarea.id}`}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormularioNuevoAtajo() {
  const { create } = useQuickTaskAdmin();
  const [text, setText] = useState('');
  const [icon, setIcon] = useState<QuickTaskIconName>('Zap');

  const crear = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    create.mutate(
      { text: trimmed, icon },
      {
        onSuccess: () => {
          setText('');
          setIcon('Zap');
          toast({ title: 'Atajo creado' });
        },
        onError: (e: any) => toast({
          variant: 'destructive', title: 'No se pudo crear',
          description: e instanceof Error ? e.message : 'Error desconocido',
        }),
      },
    );
  };

  return (
    <div className="border border-dashed border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={text}
          maxLength={60}
          placeholder="Nuevo atajo, ej. Facturación"
          onChange={(e) => setText(e.target.value)}
          data-testid="input-new-atajo-text"
        />
        <Button
          type="button"
          size="sm"
          className="gap-1 shrink-0"
          onClick={crear}
          disabled={create.isPending || !text.trim()}
          data-testid="button-create-atajo"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </Button>
      </div>
      <SelectorDeIcono value={icon} onChange={setIcon} />
    </div>
  );
}

function DialogoGestionAtajos({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: atajos = [] } = useQuickTasks();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar atajos</DialogTitle>
          <DialogDescription>
            Los botones de "Rápido" para cronometrar tareas recurrentes. Cambios visibles
            para todos apenas se guardan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {atajos.map((t) => <FilaAtajo key={t.id} tarea={t} />)}
          <FormularioNuevoAtajo />
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Atajos para las tareas recurrentes que se comen el dia (mails, WhatsApp,
 * interrupciones). Un click arranca el cronometro, otro lo para, y arrancar
 * uno detiene el anterior — eso ultimo ya lo garantiza el servidor, que
 * permite una sola entrada abierta por usuario.
 */
export function QuickTaskBar() {
  const { data: atajos = [], isError } = useQuickTasks();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [gestionOpen, setGestionOpen] = useState(false);

  // Un admin sin atajos todavia necesita ver la barra igual, para poder
  // crear el primero; para el resto (sin permiso de gestionarlos) una barra
  // vacia no aporta nada.
  if (isError || (atajos.length === 0 && !isAdmin)) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background overflow-x-auto shrink-0"
      data-testid="barra-atajos"
    >
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">
        Rápido:
      </span>
      {atajos.map((t) => (
        <BotonAtajo key={t.id} tarea={t} />
      ))}
      {isAdmin && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            title="Gestionar atajos"
            onClick={() => setGestionOpen(true)}
            data-testid="button-manage-atajos"
          >
            <Pencil className="w-3 h-3 opacity-60" />
          </Button>
          <DialogoGestionAtajos open={gestionOpen} onOpenChange={setGestionOpen} />
        </>
      )}
      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-auto pl-2 hidden sm:inline">
        hoy
      </span>
    </div>
  );
}
