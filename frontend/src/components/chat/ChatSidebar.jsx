import React from 'react';
import { Plus, MessageSquare, Trash2, Bot, Sparkles } from 'lucide-react';

export default function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onClearHistory,
}) {
  return (
    <aside className="w-full md:w-64 bg-zinc-900 text-white rounded-2xl p-4 flex flex-col justify-between gap-4 border border-zinc-800 shrink-0">
      {/* Top Header & New Chat Button */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white text-black rounded-lg">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-xs text-white">Graph AI Sessions</h3>
              <p className="font-body text-[10px] text-zinc-400">Context Memory Active</p>
            </div>
          </div>
        </div>

        <button
          onClick={onNewChat}
          className="font-heading font-semibold w-full py-2.5 px-3 bg-white text-black hover:bg-zinc-200 text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Exploration</span>
        </button>

        {/* Sessions List */}
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto no-scrollbar">
          <span className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-500 px-1">
            Recent Conversations
          </span>
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-body transition-all flex items-center gap-2.5 truncate ${
                  isActive
                    ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                <span className="truncate">{session.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-zinc-800 pt-3 flex flex-col gap-2">
        <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 font-body flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
          <span>Queries execute dynamic Cypher directly against your Neo4j database.</span>
        </div>

        <button
          onClick={onClearHistory}
          className="font-heading font-medium text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 p-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Active Chat</span>
        </button>
      </div>
    </aside>
  );
}
