import { callLLM } from '../config/llm.js';

/**
 * Atomic Tool: SuggestInsightsTool
 * Single Responsibility: Analyzes graph data patterns to produce graph insights, anomaly checks, or follow-up recommendations.
 */
export async function suggestInsightsTool({ schemaContext, queryResults }) {
  const systemPrompt = `You are a Senior Graph Analytics & Data Modeling Consultant.
Analyze the provided Graph Schema Context and Query Execution Results to produce 2-3 high-value graph insights or recommended follow-up questions for the user.`;

  const userPrompt = `Schema Context:
${schemaContext}

Query Results:
${JSON.stringify(queryResults || [], null, 2)}

Provide concise graph recommendations:`;

  return await callLLM({ systemPrompt, userPrompt, temperature: 0.3 });
}
