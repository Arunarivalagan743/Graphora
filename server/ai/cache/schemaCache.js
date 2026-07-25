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
    if (!this.cachedSchema || (!this.cachedSchema.nodes?.length && !this.cachedSchema.relationships?.length)) {
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
        // 1. Fetch Node Labels & Properties with counts
        const nodeMap = new Map();
        const labelsRes = await session.run(`
          MATCH (n)
          WITH labels(n)[0] AS label, keys(n) AS props, count(*) AS cnt
          RETURN label, props, cnt
        `);

        for (const record of labelsRes.records) {
          const label = record.get('label');
          if (!label) continue;
          const props = record.get('props') || [];
          const cnt = record.get('cnt')?.toNumber() || 0;

          if (!nodeMap.has(label)) {
            nodeMap.set(label, { label, properties: new Set(), totalCount: cnt });
          }
          const entry = nodeMap.get(label);
          props.forEach((p) => entry.properties.add(p));
        }

        // Fetch sample property values for each node label to enable natural semantic value matching
        const sampleValuesMap = new Map();
        for (const [label, nodeInfo] of nodeMap.entries()) {
          const cleanLabel = label.replace(/`/g, '``');
          for (const prop of nodeInfo.properties) {
            const cleanProp = prop.replace(/`/g, '``');
            try {
              const sampleRes = await session.run(`
                MATCH (n:\`${cleanLabel}\`)
                WHERE n.\`${cleanProp}\` IS NOT NULL AND toString(n.\`${cleanProp}\`) <> ""
                RETURN DISTINCT toString(n.\`${cleanProp}\`) AS val
                LIMIT 5
              `);
              const samples = sampleRes.records.map((r) => r.get('val')).filter(Boolean);
              if (samples.length > 0) {
                sampleValuesMap.set(`${label}:${prop}`, samples);
              }
            } catch (e) {
              // ignore per-property sample query error
            }
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

        // Format nodes array with sample values
        const nodes = Array.from(nodeMap.values()).map((n) => {
          const sampleValues = {};
          n.properties.forEach((p) => {
            const samples = sampleValuesMap.get(`${n.label}:${p}`);
            if (samples && samples.length > 0) {
              sampleValues[p] = samples;
            }
          });
          return {
            label: n.label,
            properties: Array.from(n.properties),
            sampleValues,
            count: n.totalCount
          };
        });

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
    schema.nodes.forEach((n) => {
      result += `- Node Label: \`:${n.label}\` (Count: ${n.count})\n`;
      if (n.properties && n.properties.length > 0) {
        const propDetails = n.properties.map((p) => {
          const samples = n.sampleValues && n.sampleValues[p];
          if (samples && samples.length > 0) {
            return `\`${p}\` [Sample Values: ${samples.map((s) => `'${s}'`).join(', ')}]`;
          }
          return `\`${p}\``;
        }).join(', ');
        result += `  Properties: ${propDetails}\n`;
      } else {
        result += `  Properties: None\n`;
      }
    });

    if (schema.relationships.length > 0) {
      result += '\n#### RELATIONSHIPS:\n';
      schema.relationships.forEach((r) => {
        result += `- (\`:${r.source}\`)-[\`:${r.type}\`]->(\`:${r.target}\`) (Count: ${r.count})\n`;
        if (r.properties && r.properties.length > 0) {
          result += `  Edge Properties: ${r.properties.map((p) => `\`${p}\``).join(', ')}\n`;
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
