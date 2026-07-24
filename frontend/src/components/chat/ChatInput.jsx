import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Sparkles } from 'lucide-react';

export default function ChatInput({ onSendMessage, isStreaming, onStopGeneration, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || disabled || isStreaming) return;
    onSendMessage(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col bg-white border border-zinc-300 focus-within:border-black rounded-2xl p-2.5 shadow-sm transition-all">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask any question about your Neo4j graph data (e.g. 'Who reports to John?', 'Which departments are isolated?')..."
        rows={1}
        disabled={disabled}
        className="w-full resize-none bg-transparent font-body text-xs text-zinc-900 placeholder-zinc-400 outline-none px-2 py-1 max-h-36 no-scrollbar"
      />

      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 mt-1">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono pl-2">
          <Sparkles className="w-3 h-3 text-black" />
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="font-heading font-semibold px-3 py-1.5 bg-black text-white hover:bg-zinc-800 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim() || disabled}
              className="font-heading font-semibold px-4 py-1.5 bg-black hover:bg-zinc-800 disabled:opacity-40 text-white rounded-xl text-xs flex items-center gap-1.5 transition-all"
            >
              <span>Ask AI</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
