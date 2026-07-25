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
  async runAgent({ question, sessionId, conversationHistory = '' }, onStreamChunk) {
    const maxIterations = 3;
    let iteration = 0;
    const effectiveQuestion = question;

    // 2. Fetch token-optimized dynamic schema context & sample data
    const { formattedContext } = await schemaContextBuilder.buildRelevantContext(effectiveQuestion, conversationHistory);

    const systemPrompt = `You are the Graphora Enterprise Tool-Calling AI Agent.

YOUR GOAL:
Fetch data from the Neo4j Graph Database to answer the user's query accurately using general common-sense domain knowledge, with strict zero hallucination.

AVAILABLE TOOLS & ABILITIES:
1. get_database_schema_and_sample_data(): Returns node labels, property names, and sample values.
2. execute_read_only_cypher(cypher): Executes a read-only query against Neo4j. Enforces LIMIT 50.

COMMON-SENSE SEMANTIC SCHEMA MAPPING:
1. Quality & Preference ('best', 'top', 'popular', 'highest rated', 'recommended') ➔ Map to rating/score properties in schema (e.g. \`Rating\`, \`Score\`), sorted DESC (\`ORDER BY toFloat(n.Rating) DESC\`). Always include entity name and rating in RETURN clause!
2. Price & Cost ('cheap', 'affordable', 'budget', 'expensive', 'costly') ➔ Map to price properties (\`Price\`, \`Selling_Price\`), sorted ASC/DESC.
3. Recency & Usage ('newest', 'latest', 'oldest', 'mileage') ➔ Map to \`Year\`, \`Date\`, \`filing_year\`, or \`Kms_Driven\` properties.
4. Categorical Filtering ('manual', 'diesel', 'italian', 'street food', 'operating company') ➔ Case-insensitive substring matching on corresponding schema properties: \`toLower(toString(n.propertyName)) CONTAINS toLower('term')\`.
5. Flexible Date Filtering ➔ Check both dedicated year properties (\`filing_year\`, \`Year\`) and date string properties (\`filed_date\`, \`Date\`). Notice from schema sample values that dates are stored in \`DD-MM-YYYY\` format (e.g. \`06-01-2000\`). Convert user dates like \`2000-01-04\` or \`4.1.2000\` into \`DD-MM-YYYY\` (\`04-01-2000\`) or match by year substring (e.g. \`WHERE toLower(toString(n.filed_date)) CONTAINS '2000'\` or \`toInteger(n.filing_year) = 2000\`).
6. Complete Attribute Return ➔ ALWAYS RETURN all properties mentioned, filtered, or requested in the user prompt in the RETURN clause!
7. Safe Numeric Casting ➔ Always wrap string properties with \`toFloat()\` or \`toInteger()\` when performing numeric comparisons (\`<\`, \`>\`, \`<=\`, \`>=\`) or sorting.

AGENT REASONING & EXECUTION RULES:
- ALWAYS inspect schema and sample property values before building your query.
- Use node labels listed in the schema. If labels are generic (e.g. \`:Record\`) or if querying across nodes, use generic \`MATCH (n)\`.
- Check both \`n.id\` (primary key) and \`n.propertyName\` for entity filters.
- Cypher Aliasing: In RETURN clauses, if column aliases contain spaces, ALWAYS wrap them in backticks or use underscores (e.g. AS Case_No or AS Filed_Date). NEVER write AS Case No without backticks.
- Enforce \`LIMIT 50\` on all queries to prevent memory overflow.
- If a query returns 0 rows, REASON about why (e.g. wrong property key or date format mismatch), adjust the query, and retry tool execution.
- Return Cypher inside a markdown code block (\`\`\`cypher ... \`\`\`).
- HIDE all reasoning, tool call definitions, and Cypher strings from your final answer.
- Return ONLY clean, structured, human-friendly Markdown.

ACTIVE DATABASE SCHEMA:
${formattedContext}

CONVERSATION HISTORY:
${conversationHistory || 'None'}`;

    const userPrompt = `User Question: ${effectiveQuestion}

Generate Cypher query and output ONLY the final human-friendly Markdown response:`;

    let finalMarkdownAnswer = '';
    let cypherUsed = null;
    let recordCount = 0;

    console.log('[LangChainToolAgent] Active Formatted Schema:\n', formattedContext);

    // Reasoning & Tool Calling Loop
    while (iteration < maxIterations) {
      iteration++;

      try {
        const rawLLMResponse = await callLLM({
          systemPrompt,
          userPrompt: `${userPrompt}\n\n[Reasoning Loop Iteration ${iteration}/${maxIterations}]`,
          temperature: 0.1
        });

        console.log(`[LangChainToolAgent Iteration ${iteration}] Raw LLM Response:\n`, rawLLMResponse);

        // Check if LLM output contains a Cypher block or raw Cypher text
        const cypherMatch = rawLLMResponse.match(/```(?:cypher)?\s*([\s\S]*?)\s*```/i);
        let candidateCypher = cypherMatch ? cypherMatch[1].trim() : null;

        if (!candidateCypher && (rawLLMResponse.trim().toUpperCase().startsWith('MATCH') || rawLLMResponse.trim().toUpperCase().startsWith('WITH'))) {
          candidateCypher = rawLLMResponse.trim();
        }

        if (candidateCypher) {

          // Enforce read-only validation
          const validation = validateCypherQuery(candidateCypher);
          if (validation.valid) {
            cypherUsed = validation.cypher;
            // Append LIMIT 50 if missing
            if (!/\bLIMIT\b/i.test(cypherUsed)) {
              cypherUsed += ' LIMIT 50';
            }

            console.log(`[LangChainToolAgent Iteration ${iteration}] Executing Cypher:`, cypherUsed);
            const queryResult = await neo4jReadService.executeReadOnlyQuery(cypherUsed);
            recordCount = queryResult.count;

            if (queryResult.success && queryResult.records && queryResult.records.length > 0) {
              // Synthesize final Markdown response grounded strictly in DB results
              const synthesizePrompt = `Synthesize a clear, human-friendly Markdown answer grounded strictly in these raw query execution records. Do NOT show reasoning or Cypher code:
\nDATABASE RECORDS:\n${JSON.stringify(queryResult.records, null, 2)}`;

              finalMarkdownAnswer = await callLLM({
                systemPrompt: 'You are a professional Enterprise Data Synthesizer. Output clean Markdown only.',
                userPrompt: synthesizePrompt,
                temperature: 0.2
              });
              break;
            } else {
              console.warn(`[LangChainToolAgent Iteration ${iteration}] 0 records returned. Retrying reasoning...`);
              // Provide feedback loop to LLM for retry
              const retryPrompt = `Previous Cypher returned 0 records: \`${cypherUsed}\`.\nReason about why 0 records were returned, check property key spelling or case, and output an adjusted Cypher query block.`;
              const retryResponse = await callLLM({
                systemPrompt,
                userPrompt: `${userPrompt}\n\n${retryPrompt}`,
                temperature: 0.0
              });

              const secondCypherMatch = retryResponse.match(/```(?:cypher)?\s*([\s\S]*?)\s*```/i);
              if (secondCypherMatch) {
                const secondCypher = secondCypherMatch[1].trim();
                const secondValidation = validateCypherQuery(secondCypher);
                if (secondValidation.valid) {
                  cypherUsed = secondValidation.cypher;
                  if (!/\bLIMIT\b/i.test(cypherUsed)) cypherUsed += ' LIMIT 50';
                  const secondResult = await neo4jReadService.executeReadOnlyQuery(cypherUsed);
                  recordCount = secondResult.count;

                  if (secondResult.success && secondResult.records && secondResult.records.length > 0) {
                    finalMarkdownAnswer = await callLLM({
                      systemPrompt: 'Output clean Markdown only.',
                      userPrompt: `Synthesize clean Markdown answer from DB records:\n${JSON.stringify(secondResult.records, null, 2)}`,
                      temperature: 0.2
                    });
                    break;
                  }
                }
              }

              finalMarkdownAnswer = `### Database Search Results\n\nNo matching records or relationships were found in the active Neo4j graph database for your query: **"${question}"**.\n\n> **Suggestion**: Verify property spelling or try exploring connected entities.`;
              break;
            }
          }
        }

        // If direct text answer without cypher block
        if (!candidateCypher) {
          finalMarkdownAnswer = rawLLMResponse;
          break;
        }

      } catch (err) {
        console.error(`[LangChainToolAgent Iteration ${iteration}] Error:`, err.message);
        break;
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
