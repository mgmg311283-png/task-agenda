import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Send, Terminal, Bot, User, Loader2, WifiOff } from 'lucide-react';
import { useTasks } from '@/lib/task-context';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
    id: string;
    role: 'user' | 'system';
    text: string;
    timestamp: Date;
    type?: 'success' | 'error' | 'info';
}

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
      { id: '1', role: 'system', text: 'Hola. Dicta o escribí lo que necesités, la IA interpreta todo. Presioná "/" para enfocar el chat.', timestamp: new Date(), type: 'info' }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const { state, dispatch } = useTasks();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Offline detection
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Global keyboard shortcut: "/" focuses chat, Escape clears
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setInput('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addMessage = useCallback((role: 'user' | 'system', text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role,
      text,
      timestamp: new Date(),
      type
    }]);
  }, []);

  const processCommand = async (text: string) => {
    setIsProcessing(true);

    try {
      const existingTaskIds = state.tasks.map(t => t.id);

      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, existingTaskIds }),
      });

      if (!response.ok) {
        const err = await response.json();
        addMessage('system', err.message || 'Error al procesar con IA.', 'error');
        setIsProcessing(false);
        return;
      }

      const parsed = await response.json();
      const actions = parsed.actions || [];

      if (actions.length === 0) {
        addMessage('system', parsed.summary || 'No entendí el comando.', 'error');
        setIsProcessing(false);
        return;
      }

      let successCount = 0;

      for (const action of actions) {
        if (action.action === 'create') {
          const payload = {
            text: action.text || 'Nueva tarea',
            date: action.date || 'a definir',
            person: action.person || 'a definir',
            type: action.type || 'a_definir',
            urgent: action.urgent || false,
            status: 'activa' as const,
          };
          dispatch({ type: 'ADD_TASK', payload, source: 'Chat' });
          if (actions.length === 1) {
            addMessage('system', `Agregada: "${payload.text}" para el ${payload.date}.`, 'success');
          }
          successCount++;
        } else if (action.action === 'delete' && action.id) {
          dispatch({ type: 'DELETE_TASK', payload: { id: action.id }, source: 'Chat' });
          addMessage('system', `Tarea ${action.id} eliminada.`, 'success');
        } else if (action.action === 'complete' && action.id) {
          dispatch({ type: 'COMPLETE_TASK', payload: { id: action.id }, source: 'Chat' });
          addMessage('system', `Tarea ${action.id} completada.`, 'success');
        } else if (action.action === 'update' && action.id) {
          const updates: any = {};
          if (action.text) updates.text = action.text;
          if (action.date) updates.date = action.date;
          if (action.person) updates.person = action.person;
          if (action.type) updates.type = action.type;
          if (action.urgent !== undefined) updates.urgent = action.urgent;
          dispatch({ type: 'UPDATE_TASK', payload: { id: action.id, updates }, source: 'Chat' });
          addMessage('system', `Tarea ${action.id} actualizada.`, 'success');
        } else if (action.action === 'move_expired') {
          dispatch({ type: 'MOVE_EXPIRED', source: 'Chat' });
          addMessage('system', 'Tareas vencidas movidas a hoy.', 'success');
        } else if (action.action === 'export') {
          addMessage('system', 'Usá el botón de descarga arriba para exportar CSV.', 'info');
        }
      }

      if (actions.length > 1 && successCount > 0) {
        addMessage('system', `Se procesaron ${successCount} tarea(s).`, 'success');
      }

      if (parsed.summary) {
        toast({ title: parsed.summary, duration: 3000 });
      }

    } catch {
      addMessage('system', 'Error de conexión con el servidor.', 'error');
    }

    setIsProcessing(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userText = input;
    setInput('');
    addMessage('user', userText);
    await processCommand(userText);
  };

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        inputRef.current?.focus();
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'es-AR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
      setIsListening(true);

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setInput(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error(event.error);
        setIsListening(false);
        if (event.error !== 'aborted') {
          addMessage('system', 'Error al escuchar el audio.', 'error');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      addMessage('system', 'Tu navegador no soporta dictado por voz.', 'info');
    }
  };

  return (
    <div className="flex flex-col border-t border-border bg-background shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-all duration-300">

      {isOffline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 text-xs font-mono">
          <WifiOff className="w-3 h-3 shrink-0" />
          Sin conexión — los cambios se reanudarán cuando vuelva la red.
        </div>
      )}

      {/* Chat History */}
      <div
        ref={scrollRef}
        className="max-h-[250px] overflow-y-auto p-4 space-y-3 bg-muted/20 scroll-smooth"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2 max-w-[90%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1",
              msg.role === 'user' ? "bg-foreground text-background" : "bg-blue-600 text-white"
            )}>
              {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
            </div>
            <div className={cn(
              "p-2.5 rounded-lg text-sm leading-relaxed font-mono shadow-sm",
              msg.role === 'user'
                ? "bg-background border border-border text-foreground"
                : cn(
                    "text-white",
                    msg.type === 'error' ? "bg-red-500" :
                    msg.type === 'success' ? "bg-gray-800 dark:bg-gray-700" : "bg-blue-600"
                  )
            )}>
              {msg.text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-2 max-w-[90%] mr-auto">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-3 h-3" />
            </div>
            <div className="p-2.5 rounded-lg text-sm bg-muted text-muted-foreground font-mono flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Interpretando con IA...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border sticky bottom-0 z-50">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-center">
          <div className="relative flex-1 group">
            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Dicta o pegá tareas... (presioná "/" para enfocar)'
              className="w-full bg-muted/30 border-2 border-transparent focus:border-foreground pl-10 pr-4 py-3 text-sm font-mono focus:outline-none transition-all placeholder:text-muted-foreground rounded-md dark:bg-muted/20"
              autoFocus
            />
          </div>

          <Button
            type="button"
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            className={cn(
              "h-11 w-11 shrink-0 rounded-md border-2 border-transparent bg-muted hover:bg-muted/80",
              isListening && "border-red-500 bg-red-50 text-red-500 animate-pulse"
            )}
            onClick={toggleMic}
            title="Dictado por voz"
          >
            <Mic className="h-4 w-4" />
          </Button>

          <Button
            type="submit"
            className="h-11 w-11 shrink-0 rounded-md bg-foreground text-background hover:bg-foreground/80 shadow-none border-2 border-foreground"
            disabled={!input.trim() || isProcessing}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
