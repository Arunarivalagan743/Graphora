import { callLLM } from '../config/llm.js';
import { CYPHER_GENERATION_SYSTEM_PROMPT, CYPHER_GENERATION_USER_PROMPT } from '../prompts/cypherPrompts.js';

/**
 * Atomic Tool: GenerateCypherTool
 * Single Responsibility: Generates candidate read-only Cypher query using LLM and schema context.
 */
export async function generateCypherTool({ question, schemaContext, conversationHistory = '' }) {
  const sysPrompt = CYPHER_GENERATION_SYSTEM_PROMPT
    .replace('{schemaContext}', schemaContext || 'No schema context provided.')
    .replace('{conversationHistory}', conversationHistory || 'None');
  
  const usrPrompt = CYPHER_GENERATION_USER_PROMPT.replace('{question}', question);

  const rawText = await callLLM({ systemPrompt: sysPrompt, userPrompt: usrPrompt, temperature: 0.1 });
  const cypherMatch = rawText.match(/```(?:cypher)?\s*([\s\S]*?)\s*```/i);
  return cypherMatch ? cypherMatch[1].trim() : rawText.trim();
}
