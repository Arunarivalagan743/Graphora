import { neo4jReadService } from '../../services/neo4jReadService.js';
import { suggestInsightsTool } from '../tools/suggestInsightsTool.js';
import { schemaCacheManager } from '../cache/schemaCache.js';

/**
 * Enterprise Graph Insights & Pattern Detector
 * 
 * Analyzes graph structure for disconnected nodes, isolated label clusters,
 * relationship sparsity, and business recommendations.
 */
export class InsightsGenerator {
  /**
   * Generates graph insights and structural diagnostics
   */
  async generateGraphInsights() {
    const schema = await schemaCacheManager.getSchema();

    // 1. Detect Disconnected / Isolated Nodes (Nodes with 0 degree relationships)
    const disconnectedQuery = `
      MATCH (n)
      WHERE NOT (n)--()
      RETURN labels(n)[0] AS label, count(n) AS disconnectedCount, collect(distinct keys(n))[0] AS props
      LIMIT 10
    `;
    const disconnectedRes = await neo4jReadService.executeReadOnlyQuery(disconnectedQuery);

    // 2. Detect Relationship Density & Distribution
    const relDensityQuery = `
      MATCH ()-[r]->()
      RETURN type(r) AS relType, count(r) AS edgeCount
      ORDER BY edgeCount DESC
      LIMIT 10
    `;
    const relDensityRes = await neo4jReadService.executeReadOnlyQuery(relDensityQuery);

    // 3. Generate LLM Strategic Recommendations if API key is present
    let recommendations = 'Provide CSV files with cross-entity ID columns to automatically establish rich graph relationship edges.';
    if (process.env.GEMINI_API_KEY) {
      try {
        const schemaPromptStr = schemaCacheManager.formatSchemaForPrompt(schema);
        recommendations = await suggestInsightsTool({
          schemaContext: schemaPromptStr,
          queryResults: disconnectedRes.records
        });
      } catch (e) {
        console.warn('Strategic insight LLM call failed:', e.message);
      }
    }

    return {
      success: true,
      summary: {
        totalNodeLabels: schema.nodes.length,
        totalRelTypes: schema.relationships.length,
        disconnectedGroupsCount: disconnectedRes.records.length,
        topRelationships: relDensityRes.records
      },
      disconnectedNodes: disconnectedRes.records,
      recommendations
    };
  }
}

export const insightsGenerator = new InsightsGenerator();
