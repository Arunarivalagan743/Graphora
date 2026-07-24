import { validateCypherQuery } from '../workflow/chatWorkflow.js';

/**
 * Atomic Tool: ValidateCypherTool
 * Single Responsibility: Validates syntax and enforces read-only security guardrails on candidate Cypher queries.
 */
export function validateCypherTool(cypherQuery) {
  return validateCypherQuery(cypherQuery);
}
