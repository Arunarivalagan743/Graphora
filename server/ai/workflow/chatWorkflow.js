import { langchainToolAgent } from '../agent/langchainAgent.js';
import { neo4jReadService } from '../../services/neo4jReadService.js';
import { chatMemoryManager } from '../memory/chatMemory.js';

/**
 * Validates candidate Cypher query for syntax and read-only safety.
 */
export function validateCypherQuery(cypher) {
  if (!cypher || typeof cypher !== 'string' || !cypher.trim()) {
    return { valid: false, error: 'Empty Cypher query string generated.' };
  }

  const clean = cypher.trim();
  const forbidden = /\b(CREATE|MERGE|SET|DELETE|DETACH|REMOVE|DROP|ALTER|GRANT|REVOKE)\b/i;

  if (forbidden.test(clean)) {
    return {
      valid: false,
      error: 'Cypher query rejected: Contains non-read-only mutation commands (CREATE/MERGE/SET/DELETE).'
    };
  }

  if (!/\bMATCH\b/i.test(clean) && !/\bRETURN\b/i.test(clean)) {
    return { valid: false, error: 'Cypher query must contain MATCH and RETURN statements.' };
  }

  return { valid: true, cypher: clean };
}

/**
 * Executes a read-only Cypher query against Neo4j with safe error recovery
 */
export async function executeCypherQuery(cypher) {
  return await neo4jReadService.executeReadOnlyQuery(cypher);
}

/**
 * LangChain Tool-Calling Agent Workflow Orchestrator
 * Runs Single Agent with Reasoning & Tool-Calling Ability (Hidden Reasoning Output)
 */
export class ChatWorkflowOrchestrator {
  /**
   * Executes tool agent workflow and streams final synthesized response
   */
  async runWorkflow({ question, sessionId }, onStreamChunk) {
    const conversationHistory = chatMemoryManager.getFormattedHistory(sessionId);

    return await langchainToolAgent.runAgent(
      { question, sessionId, conversationHistory },
      onStreamChunk
    );
  }
}

export const chatWorkflowOrchestrator = new ChatWorkflowOrchestrator();
