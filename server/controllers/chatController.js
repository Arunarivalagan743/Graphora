import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from '../config.js';
import { createNeo4jDriver } from '../services/neo4jService.js';
import { chatMemoryManager } from '../ai/memory/chatMemory.js';
import { chatWorkflowOrchestrator } from '../ai/workflow/chatWorkflow.js';

/**
 * POST /api/chat
 * Streams AI Assistant responses in NDJSON format
 */
export async function chatHandler(req, res) {
  const { message, sessionId = 'default-session' } = req.body;

  // Validation
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: "message" field must be a non-empty string.',
    });
  }

  // Clean user prompt to remove trailing/leading quotation marks from input typos
  const promptText = message.trim().replace(/^["']|["']$/g, '');
  
  // Store user message turn with automatic context trimming
  chatMemoryManager.addUserMessage(sessionId, promptText);

  // Set streaming headers
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendNdjson = (obj) => {
    try {
      res.write(JSON.stringify(obj) + '\n');
    } catch (e) {
      console.error('Failed to write NDJSON chunk:', e);
    }
  };

  try {
    sendNdjson({ type: 'start', sessionId });

    // Check if GROQ_API_KEY or GEMINI_API_KEY is configured
    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
      let driver;
      let nodeCount = 0;
      try {
        driver = createNeo4jDriver({ uri: NEO4J_URI, username: NEO4J_USERNAME, password: NEO4J_PASSWORD });
        await driver.verifyConnectivity();
        const session = driver.session();
        try {
          const countRes = await session.run('MATCH (n) RETURN count(n) AS count');
          nodeCount = countRes.records[0]?.get('count')?.toNumber() || 0;
        } finally {
          await session.close();
        }
      } catch (e) {} finally {
        if (driver) await driver.close();
      }

      const noteText = `⚠️ **No LLM API Key is configured on the server**.\n\nPlease configure \`GROQ_API_KEY\` or \`GEMINI_API_KEY\` in your \`server/.env\` file to enable live LLM Cypher generation against your Neo4j database (currently containing **${nodeCount}** nodes).`;
      
      for (const word of noteText.split(' ')) {
        sendNdjson({ type: 'token', text: word + ' ' });
        await new Promise((r) => setTimeout(r, 15));
      }

      const aiMsg = chatMemoryManager.addAssistantMessage(sessionId, noteText);
      sendNdjson({ type: 'done', success: true, sessionId, messageId: aiMsg.id, content: noteText });
      res.end();
      return;
    }

    // Execute LangGraph Agent Workflow
    let accumulatedText = '';
    const result = await chatWorkflowOrchestrator.runWorkflow(
      { question: promptText, sessionId },
      (chunkText) => {
        accumulatedText += chunkText;
        sendNdjson({ type: 'token', text: chunkText });
      }
    );

    const fullAnswer = result.answer || accumulatedText;
    const aiMsg = chatMemoryManager.addAssistantMessage(sessionId, fullAnswer);

    sendNdjson({
      type: 'done',
      success: true,
      sessionId,
      messageId: aiMsg.id,
      content: fullAnswer,
      cypherUsed: result.cypherUsed,
      recordCount: result.recordCount
    });
    res.end();
  } catch (err) {
    console.error('Error in chatHandler:', err);
    sendNdjson({ type: 'error', error: err.message || 'Internal AI engine error.' });
    res.end();
  }
}

/**
 * GET /api/chat/history
 * Returns chat message history for a given session
 */
export function getChatHistoryHandler(req, res) {
  const sessionId = req.query.sessionId || 'default-session';
  const history = chatMemoryManager.getMessages(sessionId);

  return res.status(200).json({
    success: true,
    sessionId,
    history,
  });
}

/**
 * DELETE /api/chat
 * Clears chat message history for a given session
 */
export function clearChatHistoryHandler(req, res) {
  const sessionId = req.query.sessionId || req.body?.sessionId || 'default-session';
  chatMemoryManager.clearSession(sessionId);

  return res.status(200).json({
    success: true,
    sessionId,
    message: `Chat history for session "${sessionId}" cleared.`,
  });
}

/**
 * GET /api/chat/status
 * Returns system health for the AI engine, Gemini API configuration, and Neo4j connectivity
 */
export async function getChatStatusHandler(req, res) {
  const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY);
  let neo4jHealthy = false;
  let nodeCount = 0;

  let driver;
  try {
    driver = createNeo4jDriver({ uri: NEO4J_URI, username: NEO4J_USERNAME, password: NEO4J_PASSWORD });
    await driver.verifyConnectivity();
    const session = driver.session();
    try {
      const countRes = await session.run('MATCH (n) RETURN count(n) AS count');
      nodeCount = countRes.records[0]?.get('count')?.toNumber() || 0;
      neo4jHealthy = true;
    } finally {
      await session.close();
    }
  } catch (e) {
    neo4jHealthy = false;
  } finally {
    if (driver) await driver.close();
  }

  return res.status(200).json({
    success: true,
    status: 'online',
    geminiConfigured: apiKeyConfigured,
    neo4jHealthy,
    totalNodes: nodeCount,
    activeSessionsCount: chatMemoryManager.sessions.size,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/chat/insights
 * Returns graph structure insights, disconnected node analysis, and business recommendations
 */
export async function getChatInsightsHandler(req, res) {
  try {
    const { insightsGenerator } = await import('../ai/generators/insightsGenerator.js');
    const insights = await insightsGenerator.generateGraphInsights();
    return res.status(200).json(insights);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to generate graph insights.' });
  }
}
