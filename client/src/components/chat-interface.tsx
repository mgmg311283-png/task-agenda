import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Send, Terminal, Bot, User } from 'lucide-react';
import { parseCommand, CommandResult } from '@/lib/parser';
import { useTasks } from '@/lib/task-context';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";

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
      { id: '1', role: 'system', text: 'Hola. ¿Qué tareas gestionamos hoy?', timestamp: new Date(), type: 'info' }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { state, dispatch } = useTasks();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages]);

  const addMessage = (role: 'user' | 'system', text: string, type: 'success' | 'error' | 'info' = 'info') => {
      setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role,
          text,
          timestamp: new Date(),
          type
      }]);
  };

  const processCommand = (text: string) => {
      setIsProcessing(true);
      
      // Simulate "thinking" delay for AI feel
      setTimeout(() => {
        const result = parseCommand(text, state.lastId + 1);
        
        if (result.action === 'create') {
            dispatch({ type: 'ADD_TASK', payload: result.payload, source: 'Chat' });
            addMessage('system', `✅ Agregada: "${result.payload.text}" para el ${result.payload.date}.`, 'success');
        } else if (result.action === 'delete') {
            dispatch({ type: 'DELETE_TASK', payload: result.payload, source: 'Chat' });
            addMessage('system', `🗑️ Tarea ${result.payload.id} eliminada.`, 'success');
        } else if (result.action === 'complete') {
            dispatch({ type: 'COMPLETE_TASK', payload: result.payload, source: 'Chat' });
            addMessage('system', `🎉 Tarea ${result.payload.id} completada.`, 'success');
        } else if (result.action === 'update') {
            dispatch({ type: 'UPDATE_TASK', payload: { id: result.payload.id, updates: result.payload }, source: 'Chat' });
            addMessage('system', `✏️ Tarea ${result.payload.id} actualizada.`, 'success');
        } else if (result.action === 'move_expired') {
            dispatch({ type: 'MOVE_EXPIRED', source: 'Chat' });
            addMessage('system', `📅 Tareas vencidas movidas a hoy.`, 'success');
        } else if (result.action === 'export') {
            addMessage('system', `📂 Usa el botón de descarga arriba para exportar CSV.`, 'info');
        } else if (result.action === 'unknown') {
            addMessage('system', result.message || 'No entendí ese comando.', 'error');
        } else if (result.action === 'help') {
            addMessage('system', `💡 Comandos: \n- "Comprar leche mañana"\n- "Urgente llamar a Juan"\n- "Completar la 12"\n- "Borrar la 5"`, 'info');
        }

        setIsProcessing(false);
      }, 600); // 600ms artificial delay
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput('');
    addMessage('user', userText);
    processCommand(userText);
  };

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        if (isListening) {
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setIsListening(true);
        // toast({ title: "Escuchando...", description: "Habla ahora..." });

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            setIsListening(false);
            inputRef.current?.focus();
            
            // Auto submit? Or let user confirm? 
            // User requested: "Mostrar la transcripción antes de ejecutar... con botón Confirmar"
            // So we just setInput and let them hit enter.
        };

        recognition.onerror = (event: any) => {
            console.error(event.error);
            setIsListening(false);
            addMessage('system', '❌ Error al escuchar el audio.', 'error');
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    } else {
        addMessage('system', '⚠️ Tu navegador no soporta voz. (Simulación activada)', 'info');
        setTimeout(() => {
            const simulatedText = "tarea: Revisar presupuesto urgente para mañana";
            setInput(simulatedText);
            inputRef.current?.focus();
        }, 1500);
    }
  };

  return (
    <div className="flex flex-col border-t border-border bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-all duration-300">
      
      {/* Chat History Area - Only visible if there are messages */}
      <div 
        ref={scrollRef}
        className="max-h-[250px] overflow-y-auto p-4 space-y-3 bg-gray-50/50 scroll-smooth"
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
                    msg.role === 'user' ? "bg-black text-white" : "bg-blue-600 text-white"
                )}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>
                <div className={cn(
                    "p-2.5 rounded-lg text-sm leading-relaxed font-mono shadow-sm",
                    msg.role === 'user' 
                        ? "bg-white border border-gray-200 text-gray-800" 
                        : cn(
                            "text-white",
                            msg.type === 'error' ? "bg-red-500" :
                            msg.type === 'success' ? "bg-gray-800" : "bg-blue-600"
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
                <div className="p-2.5 rounded-lg text-sm bg-gray-200 text-gray-500 font-mono animate-pulse">
                    Procesando...
                </div>
            </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100 sticky bottom-0 z-50">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-center">
            <div className="relative flex-1 group">
                <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-black transition-colors" />
                <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe 'reunion el viernes' o 'completar 12'..."
                className="w-full bg-gray-50 border-2 border-transparent focus:border-black pl-10 pr-4 py-3 text-sm font-mono focus:outline-none transition-all placeholder:text-gray-400 rounded-md"
                autoFocus
                />
            </div>
            
            <Button 
                type="button" 
                variant={isListening ? "destructive" : "outline"} 
                size="icon" 
                className={cn(
                    "h-11 w-11 shrink-0 rounded-md border-2 border-transparent bg-gray-100 hover:bg-gray-200 hover:border-gray-300",
                    isListening && "border-red-500 bg-red-50 text-red-500 animate-pulse"
                )}
                onClick={toggleMic}
            >
            <Mic className="h-4 w-4" />
            </Button>
            
            <Button 
                type="submit" 
                className="h-11 w-11 shrink-0 rounded-md bg-black text-white hover:bg-gray-800 shadow-none border-2 border-black"
                disabled={!input.trim()}
            >
            <Send className="h-4 w-4" />
            </Button>
        </form>
      </div>
    </div>
  );
}
