import { schemaContextBuilder } from '../context/schemaContextBuilder.js';

/**
 * Atomic Tool: GetRelevantSchemaTool
 * Single Responsibility: Extracts filtered schema context matching user question terms.
 */
export async function getRelevantSchemaTool(question) {
  if (!question) {
    throw new Error('Question prompt is required for getRelevantSchemaTool.');
  }
  return await schemaContextBuilder.buildRelevantContext(question);
}
