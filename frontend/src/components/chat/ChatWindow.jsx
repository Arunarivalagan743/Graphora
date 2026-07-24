import React, { useRef, useEffect } from 'react';
import { Bot, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatSidebar from './ChatSidebar';
import SuggestedQuestions from './SuggestedQuestions';
import LoadingSkeleton from './LoadingSkeleton';
import useChat from '../../hooks/useChat';

export default function ChatWindow() {
  const {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isStreaming,
    error,
    suggestedQuestions,
    sendMessage,
    stopGeneration,
    createNewChat,
    selectSession,
    clearSessionHistory,
  } = useChat();

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isStreaming]);

  return (
    <div className="flex flex-col md:flex-row gap-5 h-[calc(100vh-140px)] min-h-[600px] w-full animate-slide-up">
      {/* LEFT SIDEBAR */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onNewChat={createNewChat}
        onClearHistory={clearSessionHistory}
      />

      {/* MAIN CHAT CONVERSATION AREA */}
      <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-xs">
        {/* CHAT THREAD HEADER */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 bg-white -mx-4 -mt-4 px-5 py-3 border-t border-x rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black text-white rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-sm text-zinc-900 flex items-center gap-2">
                <span>Graphora AI Assistant</span>
                <span className="bg-zinc-100 text-zinc-800 text-[10px] px-2 py-0.5 rounded-full font-mono border border-zinc-300">
                  LangGraph + Neo4j Engine
                </span>
              </h2>
              <p className="font-body text-[11px] text-zinc-500">
                Ask any question in natural language. Answers are strictly grounded in your active Neo4j graph.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-black font-semibold bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-300">
                <RefreshCw className="w-3 h-3 animate-spin text-black" />
                <span>Streaming Cypher...</span>
              </span>
            )}
          </div>
        </div>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="my-2 p-3 bg-zinc-100 border border-zinc-300 text-zinc-900 rounded-xl flex items-center gap-2.5 text-xs font-body">
            <AlertCircle className="w-4 h-4 text-black shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* MESSAGES SCROLLABLE CONTAINER */}
        <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4 no-scrollbar">
          {messages.length === 0 ? (
            /* EMPTY STATE */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto my-auto">
              <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center mb-4 shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-zinc-900 mb-1">
                Explore Your Neo4j Graph with AI
              </h3>
              <p className="font-body text-xs text-zinc-500 mb-6 leading-relaxed">
                Ask about entities, relationships, reporting lines, disconnected nodes, or business anomalies. The assistant dynamically generates read-only Cypher queries.
              </p>

              <SuggestedQuestions
                questions={suggestedQuestions}
                onSelectQuestion={(q) => sendMessage(q)}
                disabled={isLoading || isStreaming}
              />
            </div>
          ) : (
            /* MESSAGES LIST */
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && !isStreaming && <LoadingSkeleton />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* CHAT INPUT AREA */}
        <div className="pt-2 border-t border-zinc-200">
          <ChatInput
            onSendMessage={sendMessage}
            isStreaming={isStreaming}
            onStopGeneration={stopGeneration}
            disabled={isLoading && !isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
