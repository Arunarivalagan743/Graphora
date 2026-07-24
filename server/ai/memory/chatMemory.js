/**
 * Enterprise Conversation Memory & Token Management System
 * 
 * Provides session management, context trimming, token estimation, and
 * follow-up context formatting for LangChain & LangGraph workflows.
 */

export class ChatMemoryManager {
  constructor(options = {}) {
    this.maxHistoryMessages = options.maxHistoryMessages || 10;
    this.maxTokenEstimate = options.maxTokenEstimate || 3000;
    this.sessions = new Map();
  }

  /**
   * Retrieves or initializes a session history buffer
   */
  getSession(sessionId = 'default-session') {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date().toISOString(),
        messages: [],
      });
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Adds a user message turn to the session
   */
  addUserMessage(sessionId, content) {
    const session = this.getSession(sessionId);
    const messageObj = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: String(content).trim(),
      timestamp: new Date().toISOString(),
    };
    session.messages.push(messageObj);
    this.trimSession(sessionId);
    return messageObj;
  }

  /**
   * Adds an AI assistant message turn to the session
   */
  addAssistantMessage(sessionId, content) {
    const session = this.getSession(sessionId);
    const messageObj = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'assistant',
      content: String(content).trim(),
      timestamp: new Date().toISOString(),
    };
    session.messages.push(messageObj);
    this.trimSession(sessionId);
    return messageObj;
  }

  /**
   * Retrieves trimmed message history formatted for prompts
   */
  getFormattedHistory(sessionId) {
    const session = this.getSession(sessionId);
    return session.messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
  }

  /**
   * Returns complete session message list
   */
  getMessages(sessionId) {
    return this.getSession(sessionId).messages;
  }

  /**
   * Clears session messages
   */
  clearSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date().toISOString(),
        messages: [],
      });
    }
  }

  /**
   * Trims conversation context to fit token window and message bounds
   */
  trimSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.messages.length === 0) return;

    // 1. Sliding window trimming by message count
    if (session.messages.length > this.maxHistoryMessages) {
      session.messages = session.messages.slice(-this.maxHistoryMessages);
    }

    // 2. Token estimation trimming (approx. 4 chars per token)
    let currentTokenEstimate = this.estimateTokens(session.messages);
    while (currentTokenEstimate > this.maxTokenEstimate && session.messages.length > 2) {
      session.messages.shift(); // Remove oldest turn
      currentTokenEstimate = this.estimateTokens(session.messages);
    }
  }

  /**
   * Quick rule-of-thumb token estimator (~4 chars = 1 token)
   */
  estimateTokens(messages) {
    const totalChars = messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
    return Math.ceil(totalChars / 4);
  }
}

// Global Singleton Instance
export const chatMemoryManager = new ChatMemoryManager({
  maxHistoryMessages: 12,
  maxTokenEstimate: 3500,
});
