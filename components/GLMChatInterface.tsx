import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface GLMChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  isLoading: boolean;
  onResetGLM: () => void;
  glmStatus: 'offline' | 'booting' | 'online';
  chatMode: 'standard' | 'effort';
  onExportWorkspace?: () => void;
  onImportWorkspace?: (file: File) => void;
}

export const GLMChatInterface: React.FC<GLMChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onResetGLM,
  glmStatus,
  chatMode,
  onExportWorkspace,
  onImportWorkspace
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  // Helper to parse deliberation trace lines and clean message content
  const renderMessageContent = (msg: ChatMessage) => {
    const isModel = msg.role === 'model';
    const text = msg.content;

    if (!isModel) {
      return <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>;
    }

    const lines = text.split('\n');
    const thoughtLines: string[] = [];
    const contentLines: string[] = [];

    // Parse trace lines like [deliberated:pattern] [method:...] [step]
    for (const line of lines) {
      if (
        line.startsWith('[deliberated') ||
        line.startsWith('[method') ||
        line.startsWith('[step') ||
        line.startsWith('[conclusion') ||
        line.includes('deliberated:')
      ) {
        thoughtLines.push(line);
      } else {
        contentLines.push(line);
      }
    }

    const cleanedContent = contentLines.join('\n').trim();

    return (
      <div className="space-y-2">
        {thoughtLines.length > 0 && (
          <details className="group border border-amber-900/30 bg-amber-950/10 rounded-md overflow-hidden">
            <summary className="px-3 py-1.5 text-xs font-semibold text-amber-400/80 hover:text-amber-300 cursor-pointer flex items-center justify-between select-none bg-amber-950/20">
              <span className="flex items-center gap-1.5 font-mono">
                🧠 View Deliberative Trace ({thoughtLines.length} steps)
              </span>
              <span className="text-[10px] transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            <div className="p-3 bg-black/40 font-mono text-[11px] text-amber-200/75 border-t border-amber-900/20 max-h-60 overflow-y-auto space-y-1 scrollbar-thin">
              {thoughtLines.map((trace, idx) => (
                <div key={idx} className="leading-relaxed border-l-2 border-amber-800/40 pl-2">
                  {trace}
                </div>
              ))}
            </div>
          </details>
        )}

        {cleanedContent ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-100">{cleanedContent}</p>
        ) : text ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-100">{text}</p>
        ) : (
          <span className="text-xs text-gray-500 italic">No output</span>
        )}
      </div>
    );
  };

  return (
    <div id="glm-chat-container" className="flex flex-col h-full bg-[#0d0a08] text-gray-200">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-amber-900/20 flex items-center justify-between bg-[#15110d]">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">GLM Session Chat</h2>
          <p className="text-[10px] text-gray-400">Direct interface to v3.7.3 active agent</p>
        </div>
        <div className="flex items-center gap-1.5">
          {onExportWorkspace && (
            <button
              onClick={onExportWorkspace}
              className="text-[10px] bg-amber-950/40 hover:bg-amber-905/50 text-amber-400 px-2 py-1 rounded border border-amber-900/30 transition-all font-mono"
              title="Download entire workspace & development state"
            >
              💾 Save Dev
            </button>
          )}
          {onImportWorkspace && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] bg-amber-950/40 hover:bg-amber-905/50 text-amber-400 px-2 py-1 rounded border border-amber-900/30 transition-all font-mono"
                title="Restore previously saved development state"
              >
                📂 Load Dev
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportWorkspace(file);
                }}
                className="hidden"
                accept=".json"
              />
            </>
          )}
          <button
            onClick={onResetGLM}
            className="text-[10px] bg-red-950/40 hover:bg-red-900/50 text-red-400 px-2.5 py-1 rounded border border-red-900/30 transition-all font-mono"
            title="Reset GLM state in Pyodide"
          >
            Reset GLM
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
      >
        {messages.map((msg) => {
          const isModel = msg.role === 'model';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isModel ? 'items-start' : 'items-end'} space-y-1 max-w-[85%] ${isModel ? 'mr-auto' : 'ml-auto'}`}
            >
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase font-mono px-1">
                <span>{isModel ? '📐 GLM Agent' : '👤 Investigator'}</span>
                <span>•</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isModel
                    ? 'bg-[#15110d] border-amber-950/40 text-gray-100 rounded-tl-none shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
                    : 'bg-amber-600/10 border-amber-500/20 text-amber-100 rounded-tr-none'
                }`}
              >
                {renderMessageContent(msg)}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start space-y-1 max-w-[85%] mr-auto">
            <div className="text-[9px] text-amber-500 uppercase font-mono animate-pulse px-1">
              📐 GLM Agent is deliberating...
            </div>
            <div className="p-4 bg-[#15110d] border border-amber-950/40 rounded-xl rounded-tl-none w-full shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs text-amber-400/80 font-mono italic">Ticks accumulating in active zones...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-amber-900/20 bg-[#110e0b]">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-black text-sm text-gray-100 rounded-lg px-4 py-3 border border-amber-950 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-amber-950/50"
            placeholder={
              glmStatus === 'online'
                ? `Send ${chatMode === 'effort' ? 'effort-guided' : 'standard'} prompt to GLM...`
                : "Boot GLM or type to auto-boot and send..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black text-sm font-bold shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-all flex items-center justify-center"
            disabled={isLoading || !input.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
