const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Service for communicating with backend Chat API endpoints
 */
export const chatApi = {
  /**
   * Fetches conversation history for a given session or all sessions
   */
  async fetchHistory(sessionId = 'default-session') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch chat history: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('chatApi.fetchHistory error:', error);
      throw error;
    }
  },

  /**
   * Clears conversation history for a given session
   */
  async clearHistory(sessionId = 'default-session') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to clear chat history: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('chatApi.clearHistory error:', error);
      throw error;
    }
  },

  /**
   * Sends a user message and consumes the response as an NDJSON stream
   * @param {Object} params
   * @param {string} params.message - User message prompt
   * @param {string} [params.sessionId] - Session ID
   * @param {Function} onChunk - Callback for incremental text chunks
   * @param {Function} onDone - Callback on completion with metadata
   * @param {Function} onError - Callback on streaming error
   * @param {AbortSignal} [signal] - Abort signal for cancelling requests
   */
  async sendMessageStream({ message, sessionId = 'default-session' }, onChunk, onDone, onError, signal) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/x-ndjson',
        },
        body: JSON.stringify({ message, sessionId }),
        signal,
      });

      if (!response.ok) {
        let errMessage = `Error ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.error) errMessage = errJson.error;
        } catch (e) {
          // ignore
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep last incomplete chunk in buffer

        for (const line of lines) {
          if (!line || !line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'token' || data.type === 'chunk') {
              if (onChunk) onChunk(data.text || data.content || '');
            } else if (data.type === 'done') {
              if (onDone) onDone(data);
            } else if (data.type === 'error') {
              if (onError) onError(new Error(data.error || 'Server stream error'));
            }
          } catch (e) {
            console.warn('Failed to parse NDJSON line:', line);
          }
        }
      }

      if (buffer && buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          if (data.type === 'token' || data.type === 'chunk') {
            if (onChunk) onChunk(data.text || data.content || '');
          } else if (data.type === 'done') {
            if (onDone) onDone(data);
          } else if (data.type === 'error') {
            if (onError) onError(new Error(data.error || 'Server stream error'));
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream request aborted by user.');
        return;
      }
      console.error('chatApi.sendMessageStream error:', error);
      if (onError) onError(error);
    }
  }
};
