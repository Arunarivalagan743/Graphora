import { NEO4J_PASSWORD, NEO4J_URI, NEO4J_USERNAME } from '../../config.js';
import { createNeo4jDriver } from '../../services/neo4jService.js';

/**
 * Enterprise Neo4j Schema Cache Manager
 * 
 * Caches node labels, property names/types, relationship types, directions,
 * and node/relationship statistics to avoid querying the DB schema on every user chat request.
 */
export class SchemaCacheManager {
  constructor() {
    this.cachedSchema = null;
    this.lastRefreshedAt = null;
    this.isRefreshing = false;
  }

  /**
   * Returns cached schema metadata. If empty, triggers async refresh.
   */
  async getSchema() {
    if (!this.cachedSchema) {
      await this.refreshCache();
    }
    return this.cachedSchema || this.getEmptySchemaFallback();
  }

  /**
   * Invalidates cached schema forcing a fresh rebuild on next access or immediately
   */
  invalidateCache() {
    this.cachedSchema = null;
    this.lastRefreshedAt = null;
    console.log('[SchemaCacheManager] Schema cache invalidated.');
  }

  /**
   * Inspects Neo4j database to extract node labels, property keys, sample types, and relationship edge definitions.
   */
  async refreshCache({ uri = NEO4J_URI, username = NEO4J_USERNAME, password = NEO4J_PASSWORD } = {}) {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    let driver;
    try {
      driver = createNeo4jDriver({ uri, username, password });
      await driver.verifyConnectivity();
      const session = driver.session();

      try {
        // 1. Fetch Node Labels & Property Keys with counts
        const labelsRes = await session.run(`
          MATCH (n)
          WITH labels(n) AS lbls, keys(n) AS props
          UNWIND lbls AS label
          UNWIND props AS prop
          RETURN label, prop, count(*) AS frequency
        `);

        const nodeMap = new Map();
        for (const record of labelsRes.records) {
          const label = record.get('label');
          const prop = record.get('prop');
          if (!label || !prop) continue;

          if (!nodeMap.has(label)) {
            nodeMap.set(label, { label, properties: new Set(), totalCount: 0 });
          }
          nodeMap.get(label).properties.add(prop);
        }

        // Fetch label node counts
        const countRes = await session.run(`
          MATCH (n)
          UNWIND labels(n) AS label
          RETURN label, count(n) AS nodeCount
        `);
        for (const record of countRes.records) {
          const label = record.get('label');
          const count = record.get('nodeCount').toNumber();
          if (nodeMap.has(label)) {
            nodeMap.get(label).totalCount = count;
          } else {
            nodeMap.set(label, { label, properties: new Set(), totalCount: count });
          }
        }

        // 2. Fetch Relationship Types & Directions with counts
        const relsRes = await session.run(`
          MATCH (a)-[r]->(b)
          WITH labels(a)[0] AS sourceLabel, type(r) AS relType, labels(b)[0] AS targetLabel, keys(r) AS relProps
          RETURN sourceLabel, relType, targetLabel, relProps, count(*) AS relCount
        `);

        const relationships = [];
        for (const record of relsRes.records) {
          const sourceLabel = record.get('sourceLabel') || 'Node';
          const relType = record.get('relType');
          const targetLabel = record.get('targetLabel') || 'Node';
          const relProps = record.get('relProps') || [];
          const relCount = record.get('relCount').toNumber();

          if (relType) {
            relationships.push({
              source: sourceLabel,
              type: relType,
              target: targetLabel,
              properties: Array.from(new Set(relProps)),
              count: relCount
            });
          }
        }

        // Format nodes array
        const nodes = Array.from(nodeMap.values()).map(n => ({
          label: n.label,
          properties: Array.from(n.properties),
          count: n.totalCount
        }));

        this.cachedSchema = {
          nodes,
          relationships,
          timestamp: new Date().toISOString()
        };
        this.lastRefreshedAt = new Date().toISOString();
        console.log(`[SchemaCacheManager] Schema cache refreshed successfully. Found ${nodes.length} node types, ${relationships.length} relationship types.`);
        return this.cachedSchema;
      } finally {
        await session.close();
      }
    } catch (err) {
      console.warn('[SchemaCacheManager] Error refreshing schema cache:', err.message);
      if (!this.cachedSchema) {
        this.cachedSchema = this.getEmptySchemaFallback();
      }
      return this.cachedSchema;
    } finally {
      this.isRefreshing = false;
      if (driver) await driver.close();
    }
  }

  /**
   * Formats cached schema into a clean text string for LLM Context Prompts
   */
  formatSchemaForPrompt(schema) {
    if (!schema || (!schema.nodes.length && !schema.relationships.length)) {
      return 'No nodes or relationships currently stored in the Neo4j database.';
    }

    let result = '### NEO4J GRAPH SCHEMA METADATA:\n\n';
    result += '#### ENTITY NODES:\n';
    schema.nodes.forEach(n => {
      result += `- Node Label: \`:${n.label}\` (Count: ${n.count})\n`;
      result += `  Properties: ${n.properties.length > 0 ? n.properties.map(p => `\`${p}\``).join(', ') : 'None'}\n`;
    });

    if (schema.relationships.length > 0) {
      result += '\n#### RELATIONSHIPS:\n';
      schema.relationships.forEach(r => {
        result += `- (\`:${r.source}\`)-[\`:${r.type}\`]->(\`:${r.target}\`) (Count: ${r.count})\n`;
        if (r.properties && r.properties.length > 0) {
          result += `  Edge Properties: ${r.properties.map(p => `\`${p}\``).join(', ')}\n`;
        }
      });
    }

    return result;
  }

  getEmptySchemaFallback() {
    return {
      nodes: [],
      relationships: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Global Singleton Instance
export const schemaCacheManager = new SchemaCacheManager();
