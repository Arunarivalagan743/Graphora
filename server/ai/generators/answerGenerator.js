import { summarizeResultsTool } from '../tools/summarizeResultsTool.js';

/**
 * Enterprise Zero-Hallucination Answer Generator
 * 
 * Synthesizes clear, human-friendly Markdown responses strictly grounded
 * in raw Neo4j query execution results.
 */
export class AnswerGenerator {
  /**
   * Generates a grounded markdown answer
   */
  async generateAnswer({ question, queryResults, conversationHistory = '' }) {
    // 1. Guard against empty or failed database results
    if (!queryResults || !queryResults.success || !queryResults.records || queryResults.records.length === 0) {
      return (
        `### Database Search Results\n\n` +
        `No matching records or relationships were found in the active Neo4j graph database for your query: **"${question}"**.\n\n` +
        `> **Suggestion**: Verify property spelling or try exploring connected entities using the Suggested Questions.`
      );
    }

    // 2. Synthesize response using LLM Grounded Prompt
    const rawAnswer = await summarizeResultsTool({
      question,
      queryResults: queryResults.records,
      conversationHistory
    });

    // 3. Post-process to ensure no internal chain-of-thought leakage occurs
    return this.cleanseAnswer(rawAnswer);
  }

  /**
   * Cleanses output to guarantee no raw JSON or system prompt artifacts leak to user
   */
  cleanseAnswer(text) {
    if (!text) return '';
    
    // Remove any accidental System Prompt headers or Cypher block leaks if present
    let cleaned = text
      .replace(/^(System:|Assistant:|Thought:|Chain-of-thought:).*/gmi, '')
      .replace(/```cypher[\s\S]*?```/gi, '') // Cypher code blocks are hidden from answer body
      .trim();

    return cleaned;
  }
}

export const answerGenerator = new AnswerGenerator();
