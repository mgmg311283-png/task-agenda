import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Send, Terminal } from 'lucide-react';
import { parseCommand } from '@/lib/parser';
import { useTasks } from '@/lib/task-context';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const { state, dispatch } = useTasks();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const result = parseCommand(input, state.lastId + 1);
    
    // Execute logic
    if (result.action === 'create') {
        dispatch({ type: 'ADD_TASK', payload: result.payload, source: 'Chat' });
        toast({ title: "Tarea creada", description: result.payload.text });
    } else if (result.action === 'delete') {
        dispatch({ type: 'DELETE_TASK', payload: result.payload, source: 'Chat' });
        toast({ title: "Tarea eliminada" });
    } else if (result.action === 'complete') {
        dispatch({ type: 'COMPLETE_TASK', payload: result.payload, source: 'Chat' });
        toast({ title: "Tarea completada" });
    } else if (result.action === 'update') {
        dispatch({ type: 'UPDATE_TASK', payload: { id: result.payload.id, updates: result.payload }, source: 'Chat' });
        toast({ title: "Tarea actualizada" });
    } else if (result.action === 'move_expired') {
        dispatch({ type: 'MOVE_EXPIRED', source: 'Chat' });
        toast({ title: "Vencidas movidas a hoy" });
    } else if (result.action === 'export') {
        // Since export is a browser download, we can't easily trigger it from here without the logic from TopBar
        // But we can notify the user
        toast({ title: "Exportar", description: "Por favor usa el botón de descarga en la barra superior." });
    } else if (result.action === 'unknown') {
        toast({ variant: "destructive", title: "Error", description: result.message });
    } else if (result.action === 'help') {
        toast({ 
            title: "Ayuda de Comandos", 
            description: "Prueba: 'tarea: comprar leche', 'completar 12', 'eliminar 5', 'mover vencidas'" 
        });
    }

    setInput('');
  };

  const toggleMic = () => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        if (isListening) {
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR'; // Set to Spanish (Argentina) as requested
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setIsListening(true);
        toast({ title: "Escuchando...", description: "Habla ahora..." });

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            setIsListening(false);
            inputRef.current?.focus();
        };

        recognition.onerror = (event: any) => {
            console.error(event.error);
            setIsListening(false);
            toast({ variant: "destructive", title: "Error", description: "No se pudo reconocer el audio." });
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    } else {
        // Fallback for browsers without support
        toast({ title: "Escuchando (Simulado)", description: "Tu navegador no soporta API de voz nativa. Simulando..." });
        setTimeout(() => {
            setInput("tarea: Revisar presupuesto urgente");
            inputRef.current?.focus();
        }, 1500);
    }
  };

  return (
    <div className="border-t border-border bg-white p-4 sticky bottom-0 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-center">
        <div className="relative flex-1 group">
            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-black transition-colors" />
            <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un comando ('tarea: ...', 'completar 12')..."
            className="w-full bg-gray-50 border-2 border-transparent focus:border-black pl-10 pr-4 py-3 text-sm font-mono focus:outline-none transition-all placeholder:text-gray-400"
            />
        </div>
        
        <Button 
            type="button" 
            variant={isListening ? "destructive" : "outline"} 
            size="icon" 
            className="h-11 w-11 shrink-0 rounded-none border-2 border-transparent bg-gray-100 hover:bg-gray-200 hover:border-gray-300"
            onClick={toggleMic}
        >
          <Mic className={cn("h-4 w-4", isListening && "animate-pulse")} />
        </Button>
        
        <Button 
            type="submit" 
            className="h-11 w-11 shrink-0 rounded-none bg-black text-white hover:bg-gray-800 shadow-none border-2 border-black"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
