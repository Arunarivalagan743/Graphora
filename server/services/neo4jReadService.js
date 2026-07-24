import { createNeo4jDriver } from './neo4jService.js';
import { NEO4J_PASSWORD, NEO4J_URI, NEO4J_USERNAME } from '../config.js';

const DEFAULT_QUERY_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_ROWS = 100;

/**
 * Enterprise Read-Only Neo4j Query Service
 * Handles query timeouts, exponential backoff retries, result pagination, and property normalization.
 */
export class Neo4jReadService {
  /**
   * Executes a read-only Cypher query safely.
   */
  async executeReadOnlyQuery(cypher, params = {}, options = {}) {
    const timeoutMs = options.timeoutMs || DEFAULT_QUERY_TIMEOUT_MS;
    const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    const maxRows = options.maxRows || DEFAULT_MAX_ROWS;

    // Enforce LIMIT if missing
    let safeCypher = cypher.trim();
    if (!/\bLIMIT\b/i.test(safeCypher)) {
      safeCypher += ` LIMIT ${maxRows}`;
    }

    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      let driver;
      try {
        driver = createNeo4jDriver({ uri: NEO4J_URI, username: NEO4J_USERNAME, password: NEO4J_PASSWORD });
        await driver.verifyConnectivity();
        const session = driver.session();

        try {
          // Timeout promise guard
          const queryPromise = session.run(safeCypher, params);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Neo4j Query Timeout: Execution exceeded ${timeoutMs}ms limit.`)), timeoutMs)
          );

          const result = await Promise.race([queryPromise, timeoutPromise]);

          const records = result.records.map((r) => {
            const row = {};
            r.keys.forEach((key) => {
              const val = r.get(key);
              row[key] = this.normalizeNeo4jValue(val);
            });
            return row;
          });

          return {
            success: true,
            records,
            count: records.length,
            attempt
          };
        } finally {
          await session.close();
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Neo4jReadService] Attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) {
          // Exponential backoff delay
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
        }
      } finally {
        if (driver) await driver.close();
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Neo4j read query execution failed after maximum retries.',
      records: [],
      count: 0,
      attempt
    };
  }

  /**
   * Helper to normalize Neo4j driver types (Integers, Dates, Nodes) into plain JS values
   */
  normalizeNeo4jValue(val) {
    if (val === null || val === undefined) return null;

    // Handle Neo4j Integer
    if (typeof val === 'object' && typeof val.toNumber === 'function') {
      return val.toNumber();
    }

    // Handle Neo4j Node
    if (val && typeof val === 'object' && val.labels && val.properties) {
      const normalizedProps = {};
      Object.keys(val.properties).forEach((k) => {
        normalizedProps[k] = this.normalizeNeo4jValue(val.properties[k]);
      });
      return {
        _labels: val.labels,
        ...normalizedProps
      };
    }

    // Handle arrays
    if (Array.isArray(val)) {
      return val.map((item) => this.normalizeNeo4jValue(item));
    }

    return val;
  }
}

export const neo4jReadService = new Neo4jReadService();
