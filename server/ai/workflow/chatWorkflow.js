import { callLLM } from '../config/llm.js';
import { schemaContextBuilder } from '../context/schemaContextBuilder.js';
import { chatMemoryManager } from '../memory/chatMemory.js';
import { CYPHER_GENERATION_SYSTEM_PROMPT, CYPHER_GENERATION_USER_PROMPT } from '../prompts/cypherPrompts.js';
import { neo4jReadService } from '../../services/neo4jReadService.js';
import { answerGenerator } from '../generators/answerGenerator.js';

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
 * LangGraph Agent Workflow Orchestrator
 * Runs: Context -> Cypher Gen -> Validation -> Execution -> Answer Synthesis
 */
export class ChatWorkflowOrchestrator {
  /**
   * Executes full workflow and streams/returns generated response
   */
  async runWorkflow({ question, sessionId }, onStreamChunk) {
    // 1. Extract Conversation History & Relevant Schema Context
    const conversationHistory = chatMemoryManager.getFormattedHistory(sessionId);
    const { formattedContext } = await schemaContextBuilder.buildRelevantContext(question, conversationHistory);

    // 2. Generate Candidate Read-Only Cypher Query
    const sysPrompt = CYPHER_GENERATION_SYSTEM_PROMPT
      .replace('{schemaContext}', formattedContext)
      .replace('{conversationHistory}', conversationHistory || 'None');
    
    const usrPrompt = CYPHER_GENERATION_USER_PROMPT.replace('{question}', question);

    let rawCypherText = await callLLM({ systemPrompt: sysPrompt, userPrompt: usrPrompt, temperature: 0.1 });
    
    // Extract Cypher from code block if wrapped
    const cypherMatch = rawCypherText.match(/```(?:cypher)?\s*([\s\S]*?)\s*```/i);
    let cypherQuery = cypherMatch ? cypherMatch[1].trim() : rawCypherText.trim();

    console.log('[ChatWorkflow] Formatted Schema Context:\n', formattedContext);
    console.log('[ChatWorkflow] Generated Cypher:', cypherQuery);

    // 3. Validate Cypher Safety
    let validation = validateCypherQuery(cypherQuery);
    if (!validation.valid) {
      console.warn('[ChatWorkflow] Initial Cypher invalid, retrying:', validation.error);
      const retrySysPrompt = sysPrompt + `\n\nERROR IN PREVIOUS CYPHER: ${validation.error}. FIX THE QUERY AND RETURN ONLY VALID READ-ONLY CYPHER.`;
      rawCypherText = await callLLM({ systemPrompt: retrySysPrompt, userPrompt: usrPrompt, temperature: 0.0 });
      const retryMatch = rawCypherText.match(/```(?:cypher)?\s*([\s\S]*?)\s*```/i);
      cypherQuery = retryMatch ? retryMatch[1].trim() : rawCypherText.trim();
      validation = validateCypherQuery(cypherQuery);
    }

    // 4. Execute Read-Only Query against Neo4j
    let queryResult = { success: false, records: [], count: 0 };
    if (validation.valid) {
      queryResult = await executeCypherQuery(validation.cypher);
      console.log('[ChatWorkflow] Query Result Count:', queryResult.count, 'Records:', JSON.stringify(queryResult.records));
    }

    // 5. Synthesize Final Human-Friendly Markdown Answer (Zero Hallucination)
    const finalAnswer = await answerGenerator.generateAnswer({
      question,
      queryResults: queryResult,
      conversationHistory
    });

    // Stream tokens if callback provided
    if (onStreamChunk) {
      const words = finalAnswer.split(' ');
      for (const word of words) {
        onStreamChunk(word + ' ');
        await new Promise((r) => setTimeout(r, 15));
      }
    }

    return {
      success: true,
      answer: finalAnswer,
      cypherUsed: validation.valid ? validation.cypher : null,
      recordCount: queryResult.count
    };
  }
}

export const chatWorkflowOrchestrator = new ChatWorkflowOrchestrator();
