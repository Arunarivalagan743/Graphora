import { useState, useCallback, useRef, useEffect } from 'react';
import { chatApi } from '../services/chatApi';

const DEFAULT_SUGGESTIONS = [
  'Explain this graph schema and relationship connections.',
  'Find disconnected nodes and isolated entities.',
  'Summarize customer or employee records in the database.',
  'What key insights or missing relationships do you observe?',
];

export default function useChat() {
  const [sessions, setSessions] = useState([
    { id: 'session-1', title: 'Graphora Assistant', lastActivity: new Date().toISOString() }
  ]);
  const [activeSessionId, setActiveSessionId] = useState('session-1');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  // Load session history on session change
  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await chatApi.fetchHistory(activeSessionId);
        if (isMounted && res && res.history) {
          const formatted = res.history.map((item) => ({
            id: item.id || `msg-${Date.now()}-${Math.random()}`,
            sender: item.role === 'user' ? 'user' : 'ai',
            text: item.content || item.text || '',
            timestamp: item.timestamp || new Date().toISOString(),
          }));
          setMessages(formatted);
        }
      } catch (err) {
        console.warn('Failed to load history, initializing clean session:', err);
        if (isMounted) setMessages([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [activeSessionId]);

  const createNewChat = useCallback(() => {
    const newSessionId = `session-${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'New Graph Exploration',
      lastActivity: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    setMessages([]);
    setError(null);
  }, []);

  const selectSession = useCallback((sessionId) => {
    setActiveSessionId(sessionId);
  }, []);

  const clearSessionHistory = useCallback(async () => {
    try {
      await chatApi.clearHistory(activeSessionId);
      setMessages([]);
      setError(null);
    } catch (err) {
      setError('Failed to clear chat history.');
    }
  }, [activeSessionId]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (promptText) => {
      if (!promptText || !promptText.trim()) return;

      const trimmedText = promptText.trim();
      setError(null);

      // Create User message bubble
      const userMsgId = `user-${Date.now()}`;
      const userMsg = {
        id: userMsgId,
        sender: 'user',
        text: trimmedText,
        timestamp: new Date().toISOString(),
      };

      // Create AI placeholder bubble
      const aiMsgId = `ai-${Date.now()}`;
      const aiMsg = {
        id: aiMsgId,
        sender: 'ai',
        text: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setIsLoading(true);
      setIsStreaming(true);

      // Update session title if first message
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId && s.title === 'New Graph Exploration'
            ? { ...s, title: trimmedText.slice(0, 28) + (trimmedText.length > 28 ? '...' : '') }
            : s
        )
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedText = '';

      const handleChunk = (chunkText) => {
        setIsLoading(false);
        accumulatedText += chunkText;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, text: accumulatedText, isStreaming: true } : m
          )
        );
      };

      const handleDone = (meta) => {
        setIsStreaming(false);
        setIsLoading(false);
        abortControllerRef.current = null;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  text: accumulatedText || meta.content || 'Response complete.',
                  isStreaming: false,
                }
              : m
          )
        );
      };

      const handleError = (err) => {
        setIsStreaming(false);
        setIsLoading(false);
        abortControllerRef.current = null;
        const errText = err?.message || 'An error occurred while generating the answer.';
        setError(errText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  text: accumulatedText
                    ? accumulatedText + `\n\n> ⚠️ *Stream interrupted: ${errText}*`
                    : `⚠️ **Error**: ${errText}. Please ensure backend server is running and Neo4j connectivity is healthy.`,
                  isStreaming: false,
                  error: true,
                }
              : m
          )
        );
      };

      await chatApi.sendMessageStream(
        { message: trimmedText, sessionId: activeSessionId },
        handleChunk,
        handleDone,
        handleError,
        controller.signal
      );
    },
    [activeSessionId]
  );

  return {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isStreaming,
    error,
    suggestedQuestions: DEFAULT_SUGGESTIONS,
    sendMessage,
    stopGeneration,
    createNewChat,
    selectSession,
    clearSessionHistory,
  };
}
