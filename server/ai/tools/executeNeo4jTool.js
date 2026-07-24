import { neo4jReadService } from '../../services/neo4jReadService.js';

/**
 * Atomic Tool: ExecuteNeo4jTool
 * Single Responsibility: Executes a validated read-only Cypher query against Neo4j database using enterprise timeout and retry handling.
 */
export async function executeNeo4jTool(cypherQuery) {
  return await neo4jReadService.executeReadOnlyQuery(cypherQuery);
}
