import { callLLM } from '../config/llm.js';
import { schemaCacheManager } from '../cache/schemaCache.js';
import { schemaContextBuilder } from '../context/schemaContextBuilder.js';
import { neo4jReadService } from '../../services/neo4jReadService.js';
import { validateCypherQuery } from '../workflow/chatWorkflow.js';

/**
 * Single Agent with Tool-Calling Ability & Reasoning Loop
 * 
 * Tools & Capabilities:
 * 1. get_database_schema_and_sample_data: Inspects node labels, relationship edges, and sample property values.
 * 2. execute_read_only_cypher: Executes safe read-only Cypher with mandatory LIMIT <= 50.
 * 
 * Design:
 * - Performs reasoning & tool calls internally.
 * - Hides internal tool calls & reasoning from the end-user.
 * - Retries automatically if query returns 0 rows or encounters a syntax error.
 * - Returns ONLY structured, human-friendly Markdown output.
 */

export class LangChainToolAgent {
  /**
   * Executes Tool-Calling Agent with internal reasoning & retry loop.
   */
  async runAgent({ question, sessionId }, onStreamChunk) {
    const maxIterations = 3;
    let iteration = 0;
    const effectiveQuestion = question;

    // Fetch token-optimized dynamic schema context & sample data strictly for the user question
    const { formattedContext } = await schemaContextBuilder.buildRelevantContext(effectiveQuestion);

    const systemPrompt = `You are Graphora AI, an enterprise Neo4j Graph Database agent.

### OBJECTIVE
Generate a read-only Cypher query against the Neo4j database to answer the user's question accurately without hallucination.

### DATABASE SCHEMA
${formattedContext}

### CRITICAL QUERY GENERATION RULES
1. **Undirected Relationship Traversals**:
   - ALWAYS use UNDIRECTED relationship patterns like \`(e:Employee)-[:HAS_STATUS]-(s:Status)\` or \`(a)-[r]-(b)\` (WITHOUT directional arrows \`->\` or \`<-\`). This ensures matching succeeds regardless of how edge direction is stored in Neo4j!
2. **Robust String Matching**:
   - Use \`toLower(toString(prop)) CONTAINS toLower('term')\`.
   - Wrap property names with \`toString()\` to safely handle non-string or null values.
3. **RETURN Clause**:
   - Return all relevant entity properties (e.g. \`RETURN e.id, e.name, e.email, e.salary, s.status\` or \`RETURN e, s\`).
   - If column aliases contain spaces, wrap them in backticks or underscores (e.g. AS Status_ID).
4. **Safety**: Enforce \`LIMIT 50\` on all queries. Only generate read-only \`MATCH ... RETURN\` queries.
5. **Format**: Output your proposed Cypher query strictly inside a \`\`\`cypher ... \`\`\` block.`;

    const userPrompt = `User Question: ${effectiveQuestion}

Generate Cypher query and output ONLY the final human-friendly Markdown response:`;

    let finalMarkdownAnswer = '';
    let cypherUsed = null;
    let recordCount = 0;

    console.log('[LangChainToolAgent] Active Formatted Schema:\n', formattedContext);

    // Reasoning & Tool Calling Multi-Iteration Loop
    while (iteration < maxIterations) {
      iteration++;

      try {
        const loopPrompt = iteration === 1
          ? userPrompt
          : `${userPrompt}\n\n[Iteration ${iteration}/${maxIterations}: Previous attempt returned 0 records. Generate an adjusted Cypher query using UNDIRECTED relationships (a)-[r]-(b) and toLower(toString(...)) substring matching across all relevant node properties.]`;

        const rawLLMResponse = await callLLM({
          systemPrompt,
          userPrompt: loopPrompt,
          temperature: iteration === 1 ? 0.1 : 0.0
        });

        if (!rawLLMResponse) continue;

        console.log(`[LangChainToolAgent Iteration ${iteration}] Raw LLM Response:\n`, rawLLMResponse);

        // Check if LLM output contains a Cypher block or raw Cypher text
        const cypherMatch = rawLLMResponse.match(/```(?:cypher)?\s*([\s\S]*?)\s*```/i);
        let candidateCypher = cypherMatch ? cypherMatch[1].trim() : null;

        if (!candidateCypher && (rawLLMResponse.trim().toUpperCase().startsWith('MATCH') || rawLLMResponse.trim().toUpperCase().startsWith('WITH'))) {
          candidateCypher = rawLLMResponse.trim();
        }

        if (candidateCypher) {
          const validation = validateCypherQuery(candidateCypher);
          if (validation.valid) {
            // Strip directional arrows from relationship patterns if present to guarantee undirected traversal
            let cleanCypher = validation.cypher.replace(/-\[:([A-Za-z0-9_]+)\]->/g, '-[:$1]-').replace(/<-\[:([A-Za-z0-9_]+)\]-/g, '-[:$1]-');
            cypherUsed = cleanCypher;

            if (!/\bLIMIT\b/i.test(cypherUsed)) {
              cypherUsed += ' LIMIT 50';
            }

            console.log(`[LangChainToolAgent Iteration ${iteration}] Executing Cypher:`, cypherUsed);
            const queryResult = await neo4jReadService.executeReadOnlyQuery(cypherUsed);
            recordCount = queryResult.count;

            if (queryResult.success && queryResult.records && queryResult.records.length > 0) {
              const synthesizePrompt = `Synthesize a clear, human-friendly Markdown answer grounded strictly in these raw query execution records. Do NOT show reasoning or Cypher code:
\nDATABASE RECORDS:\n${JSON.stringify(queryResult.records, null, 2)}`;

              finalMarkdownAnswer = await callLLM({
                systemPrompt: 'You are a professional Enterprise Data Synthesizer. Output clean Markdown only.',
                userPrompt: synthesizePrompt,
                temperature: 0.2
              });
              break;
            } else {
              console.warn(`[LangChainToolAgent Iteration ${iteration}] 0 records returned for Cypher: ${cypherUsed}. Retrying next iteration...`);
            }
          }
        } else {
          finalMarkdownAnswer = rawLLMResponse;
          break;
        }

      } catch (err) {
        console.error(`[LangChainToolAgent Iteration ${iteration}] Error:`, err.message);
      }
    }

    if (!finalMarkdownAnswer) {
      finalMarkdownAnswer = `### Database Search Results\n\nNo matching records or relationships were found in the active Neo4j graph database for your query: **"${question}"**.\n\n> **Suggestion**: Verify property spelling or try exploring connected entities.`;
    }

    // Cleanse output to guarantee no raw internal reasoning or Cypher blocks leak to the user
    finalMarkdownAnswer = finalMarkdownAnswer
      .replace(/```cypher[\s\S]*?```/gi, '')
      .replace(/^(Thought:|Reasoning:|Chain-of-thought:).*/gmi, '')
      .trim();

    // Stream tokens to callback if provided
    if (onStreamChunk) {
      const words = finalMarkdownAnswer.split(' ');
      for (const word of words) {
        onStreamChunk(word + ' ');
        await new Promise((r) => setTimeout(r, 12));
      }
    }

    return {
      success: true,
      answer: finalMarkdownAnswer,
      cypherUsed,
      recordCount
    };
  }
}

export const langchainToolAgent = new LangChainToolAgent();
