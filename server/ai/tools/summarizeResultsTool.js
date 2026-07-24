import { callLLM } from '../config/llm.js';
import { ANSWER_SYNTHESIS_SYSTEM_PROMPT, ANSWER_SYNTHESIS_USER_PROMPT } from '../prompts/answerPrompts.js';

/**
 * Atomic Tool: SummarizeResultsTool
 * Single Responsibility: Synthesizes ground-truth Neo4j execution results into a human-friendly Markdown response.
 */
export async function summarizeResultsTool({ question, queryResults, conversationHistory = '' }) {
  const sysPrompt = ANSWER_SYNTHESIS_SYSTEM_PROMPT
    .replace('{queryResults}', JSON.stringify(queryResults || [], null, 2))
    .replace('{conversationHistory}', conversationHistory || 'None');

  const usrPrompt = ANSWER_SYNTHESIS_USER_PROMPT.replace('{question}', question);

  return await callLLM({ systemPrompt: sysPrompt, userPrompt: usrPrompt, temperature: 0.2 });
}
