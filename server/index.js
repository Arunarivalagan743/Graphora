import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import neo4j from 'neo4j-driver';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so the React app can communicate with the backend
app.use(cors());
app.use(express.json({ limit: '50mb' })); // support large CSV payloads

// Serve static assets from public folder (monitor dashboard)
app.use(express.static(path.join(__dirname, 'public')));

// In-memory log database to store success/failure records
const uploadLogs = [];

/**
 * POST /api/upload
 * Expects body containing:
 * - uri (optional, falls back to env)
 * - username (optional, falls back to env)
 * - password (optional, falls back to env)
 * - label (optional, default 'Record')
 * - data (required, array of objects to insert)
 */
function escapeIdentifier(str) {
  return str.replace(/`/g, '``');
}

/**
 * POST /api/upload
 * Expects body containing:
 * - uri (optional, falls back to env)
 * - username (optional, falls back to env)
 * - password (optional, falls back to env)
 * - label (optional, default 'Record')
 * - data (required, array of objects to insert)
 * - nodes (optional, dynamic schema nodes mapping)
 * - relationships (optional, dynamic schema relationships mapping)
 */
app.post('/api/upload', async (req, res) => {
  const { uri, username, password, label, data, nodes, relationships } = req.body;

  // Retrieve credentials from request body or fall back to .env configuration
  const neoUri = (uri && String(uri).trim()) ? uri : (process.env.NEO4J_URI || 'bolt://localhost:7687');
  const neoUser = (username && String(username).trim()) ? username : (process.env.NEO4J_USERNAME || 'neo4j');
  const neoPass = (password && String(password).trim()) ? password : (process.env.NEO4J_PASSWORD || '');
  const cleanLabel = (label || 'Record').replace(/[^a-zA-Z0-9]/g, '') || 'Record';

  // Create log entry template
  const logEntry = {
    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    uri: neoUri,
    label: nodes && Array.isArray(nodes) ? 'Dynamic Schema' : cleanLabel,
    recordCount: Array.isArray(data) ? data.length : 0,
    status: 'pending',
    error: null
  };

  // Validation checks
  if (!Array.isArray(data) || data.length === 0) {
    const errorMsg = 'Invalid request data: "data" must be a non-empty array of objects.';
    logEntry.status = 'failure';
    logEntry.error = errorMsg;
    uploadLogs.unshift(logEntry);
    return res.status(400).json({ success: false, error: errorMsg, logEntry });
  }

  let driver;
  try {
    // Initialize Neo4j driver
    driver = neo4j.driver(neoUri, neo4j.auth.basic(neoUser, neoPass));

    // Verify connectivity before executing queries
    await driver.verifyConnectivity();

    const session = driver.session();

    // Check if dynamic graph mapping is requested
    if (nodes && Array.isArray(nodes) && nodes.length > 0) {
      console.log('--- DYNAMIC SCHEMA UPLOAD STARTED ---');
      console.log('Nodes Mapping:', JSON.stringify(nodes, null, 2));
      console.log('Relationships Mapping:', JSON.stringify(relationships, null, 2));
      try {
        await session.executeWrite(async (tx) => {
          // 1. Process all dynamic Node Mappings
          for (const nodeMap of nodes) {
            const { label: nodeLabel, idColumn, properties } = nodeMap;
            if (!nodeLabel || !idColumn) {
              console.log(`Skipping node mapping: label or idColumn is missing`, nodeMap);
              continue;
            }

            const cleanNodeLabel = nodeLabel.replace(/[^a-zA-Z0-9_]/g, '');
            if (!cleanNodeLabel) {
              console.log(`Skipping node mapping: cleaned label is empty`, nodeMap);
              continue;
            }

            const escIdCol = escapeIdentifier(idColumn);
            const setClauses = (properties || [])
              .map(prop => {
                const escProp = escapeIdentifier(prop);
                return `n.\`${escProp}\` = row.\`${escProp}\``;
              });

            const setClauseStr = setClauses.length > 0
              ? `ON CREATE SET ${setClauses.join(', ')}\nON MATCH SET ${setClauses.join(', ')}`
              : '';

            const nodeQuery = `
              UNWIND $rows AS row
              WITH row
              WHERE row.\`${escIdCol}\` IS NOT NULL AND toString(row.\`${escIdCol}\`) <> ""
              MERGE (n:\`${cleanNodeLabel}\` {id: toString(row.\`${escIdCol}\`)})
              ${setClauseStr}
            `;

            console.log(`Executing Node Query for label :${cleanNodeLabel}:`);
            console.log(nodeQuery);

            const result = await tx.run(nodeQuery, { rows: data });
            console.log(`Node Query completed. Summary:`, result.summary?.counters?.updates());
          }

          // 2. Process all dynamic Relationship Mappings
          if (relationships && Array.isArray(relationships)) {
            for (const relMap of relationships) {
              const { sourceNodeId, type: relType, targetNodeId, properties } = relMap;
              if (!relType) {
                console.log(`Skipping relationship mapping: type is missing`, relMap);
                continue;
              }

              const sourceNode = nodes.find(n => n.id === sourceNodeId);
              const targetNode = nodes.find(n => n.id === targetNodeId);
              if (!sourceNode || !targetNode) {
                console.log(`Skipping relationship mapping: source or target node not found`, relMap);
                continue;
              }

              const cleanSourceLabel = sourceNode.label.replace(/[^a-zA-Z0-9_]/g, '');
              const cleanTargetLabel = targetNode.label.replace(/[^a-zA-Z0-9_]/g, '');
              const cleanRelType = relType.replace(/[^a-zA-Z0-9_]/g, '');

              if (!cleanSourceLabel || !cleanTargetLabel || !cleanRelType) {
                console.log(`Skipping relationship mapping: labels or type are invalid after cleaning`, relMap);
                continue;
              }

              const escSrcIdCol = escapeIdentifier(sourceNode.idColumn);
              const escTgtIdCol = escapeIdentifier(targetNode.idColumn);

              const setClauses = (properties || []).map(prop => {
                const escProp = escapeIdentifier(prop);
                return `r.\`${escProp}\` = row.\`${escProp}\``;
              });

              const setClauseStr = setClauses.length > 0
                ? `ON CREATE SET ${setClauses.join(', ')}\nON MATCH SET ${setClauses.join(', ')}`
                : '';

              const relQuery = `
                UNWIND $rows AS row
                WITH row
                WHERE row.\`${escSrcIdCol}\` IS NOT NULL AND toString(row.\`${escSrcIdCol}\`) <> ""
                  AND row.\`${escTgtIdCol}\` IS NOT NULL AND toString(row.\`${escTgtIdCol}\`) <> ""
                MERGE (src:\`${cleanSourceLabel}\` {id: toString(row.\`${escSrcIdCol}\`)})
                MERGE (tgt:\`${cleanTargetLabel}\` {id: toString(row.\`${escTgtIdCol}\`)})
                MERGE (src)-[r:\`${cleanRelType}\`]->(tgt)
                ${setClauseStr}
              `;

              console.log(`Executing Relationship Query [${cleanRelType}]:`);
              console.log(relQuery);

              const result = await tx.run(relQuery, { rows: data });
              console.log(`Relationship Query completed. Summary:`, result.summary?.counters?.updates());
            }
          }
        });

        console.log('--- DYNAMIC SCHEMA UPLOAD COMPLETED SUCCESSFULLY ---');
        // Update log entry on success
        logEntry.status = 'success';
        uploadLogs.unshift(logEntry);

        return res.status(200).json({
          success: true,
          message: `Successfully uploaded nodes and relationships dynamically using schema mapping.`,
          logEntry
        });
      } finally {
        await session.close();
      }
    }
    // Fall back to dynamic single-node upload if specific schema mappings are not provided
    const escCleanLabel = escapeIdentifier(cleanLabel);
    const cypherQuery = `
      UNWIND $rows AS row
      CREATE (n:\`${escCleanLabel}\`)
      SET n = row
    `;
    const uploadRows = data;

    try {
      await session.executeWrite(tx => tx.run(cypherQuery, { rows: uploadRows }));
      
      // Update log entry on success
      logEntry.status = 'success';
      uploadLogs.unshift(logEntry);

      return res.status(200).json({
        success: true,
        message: `Successfully uploaded ${data.length} nodes to Neo4j database under label :${cleanLabel}`,
        logEntry
      });
    } finally {
      await session.close();
    }
  } catch (err) {
    // Update log entry on failure
    logEntry.status = 'failure';
    logEntry.error = err.message || 'Database transaction failed.';
    uploadLogs.unshift(logEntry);

    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during connection or database insert.',
      logEntry
    });
  } finally {
    if (driver) {
      await driver.close();
    }
  }
});

/**
 * GET /api/logs
 * Retrieve all success and failure logs
 */
app.get('/api/logs', (req, res) => {
  res.status(200).json({ success: true, logs: uploadLogs });
});

/**
 * POST /api/logs/clear
 * Clear all the log history
 */
app.post('/api/logs/clear', (req, res) => {
  uploadLogs.length = 0;
  res.status(200).json({ success: true, message: 'Upload logs cleared successfully.' });
});

/**
 * POST /api/clear-nodes
 * Clears nodes from the database.
 * If body contains a label, clears nodes of that label: MATCH (n:Label) DETACH DELETE n
 * If label is empty or '*', clears all nodes: MATCH (n) DETACH DELETE n
 */
app.post('/api/clear-nodes', async (req, res) => {
  const { label } = req.body;
  const neoUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neoUser = process.env.NEO4J_USERNAME || 'neo4j';
  const neoPass = process.env.NEO4J_PASSWORD || '';
  
  let driver;
  try {
    driver = neo4j.driver(neoUri, neo4j.auth.basic(neoUser, neoPass));
    await driver.verifyConnectivity();
    
    const session = driver.session();
    
    try {
      let cypherQuery = '';
      let message = '';

      if (label && label !== '*') {
        const cleanLabel = label.replace(/[^a-zA-Z0-9_]/g, '');
        cypherQuery = `MATCH (n:\`${cleanLabel}\`) DETACH DELETE n`;
        message = `Successfully deleted all nodes under label :${cleanLabel}`;
        await session.executeWrite(tx => tx.run(cypherQuery));
      } else {
        // 1. Delete all nodes and relationships
        await session.executeWrite(tx => tx.run(`MATCH (n) DETACH DELETE n`));
        
        // 2. Drop custom constraints if any
        try {
          const constraintsRes = await session.run(`SHOW CONSTRAINTS YIELD name`);
          for (const record of constraintsRes.records) {
            const constraintName = record.get('name');
            if (constraintName) {
              await session.run(`DROP CONSTRAINT \`${constraintName}\` IF EXISTS`);
            }
          }
        } catch (e) {
          // Ignore if constraints query not supported in current Neo4j edition
        }

        // 3. Drop custom indexes if any
        try {
          const indexesRes = await session.run(`SHOW INDEXES YIELD name`);
          for (const record of indexesRes.records) {
            const indexName = record.get('name');
            if (indexName && !indexName.startsWith('LOOKUP')) {
              await session.run(`DROP INDEX \`${indexName}\` IF EXISTS`);
            }
          }
        } catch (e) {
          // Ignore if indexes query not supported
        }

        message = `Successfully wiped all nodes, relationships, indexes, and constraints from the database.`;
      }

      return res.status(200).json({ success: true, message });
    } finally {
      await session.close();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete database nodes.' });
  } finally {
    if (driver) {
      await driver.close();
    }
  }
});

/**
 * POST /api/generate-schema
 * Expects body containing:
 * - headers (array of strings)
 * - data (sample array of objects, e.g., first 5 rows)
 */
app.post('/api/generate-schema', async (req, res) => {
  const { headers, data: sampleData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    return res.status(400).json({ success: false, error: 'Headers are required for schema generation.' });
  }

  const prompt = `You are an expert Neo4j graph data modeler.

Analyze the following CSV headers and sample dataset rows.

CSV Headers:
${headers.join(', ')}

Sample Data (JSON format):
${JSON.stringify(sampleData || [], null, 2)}

INSTRUCTIONS FOR GRAPH SCHEMA GENERATION:
1. Identify the primary entity (e.g. Case, Employee, Order, Invoice, Product).
2. Identify distinct secondary nodes for categorical attributes, statuses, locations, or related entities (e.g. Status, Department, City, Category, Flag, Company).
3. CRITICAL: Every node's "primaryKey" MUST BE AN EXACT CASE-SENSITIVE STRING MATCH to one of the provided CSV Headers! Do NOT invent new header names like "Case ID" if the header is "case_no".
4. Define relationship links connecting the primary entity node to secondary nodes (e.g. Case -> HAS_STATUS -> Status, Case -> HAS_FLAG -> Flag).
5. Always return at least 2 distinct node labels and at least 1 relationship type so Neo4j displays a connected graph network with relationships.
6. Return strictly valid JSON only.

JSON Format:
{
  "nodes": [
    {
      "label": "Case",
      "primaryKey": "case_no",
      "properties": ["case_no", "filed_date", "closed_date"]
    },
    {
      "label": "Status",
      "primaryKey": "status",
      "properties": ["status"]
    }
  ],
  "relationships": [
    {
      "source": "Case",
      "target": "Status",
      "type": "HAS_STATUS"
    }
  ]
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error?.message || 'Gemini API returned an error.');
    }

    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('Empty response received from Gemini API.');
    }

    const schema = JSON.parse(textResponse);
    return res.status(200).json({ success: true, schema });
  } catch (err) {
    console.error('Failed to generate schema via Gemini:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to generate schema.' });
  }
});

/**
 * GET /api/db-diagnostics
 * Query Neo4j database and return detailed metadata about nodes and relationships
 */
app.get('/api/db-diagnostics', async (req, res) => {
  const neoUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neoUser = process.env.NEO4J_USERNAME || 'neo4j';
  const neoPass = process.env.NEO4J_PASSWORD || '';

  let driver;
  try {
    driver = neo4j.driver(neoUri, neo4j.auth.basic(neoUser, neoPass));
    await driver.verifyConnectivity();
    const session = driver.session();

    try {
      // 1. Get count of all nodes group by label
      const labelsRes = await session.run('MATCH (n) RETURN labels(n) AS labels, count(n) AS count');
      const labels = labelsRes.records.map(r => ({
        labels: r.get('labels'),
        count: r.get('count').toNumber()
      }));

      // 2. Get count of all relationships grouped by type
      const relsRes = await session.run('MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count');
      const relationships = relsRes.records.map(r => ({
        type: r.get('type'),
        count: r.get('count').toNumber()
      }));

      // 3. Get total nodes count
      const totalNodesRes = await session.run('MATCH (n) RETURN count(n) AS count');
      const totalNodes = totalNodesRes.records[0].get('count').toNumber();

      return res.status(200).json({
        success: true,
        totalNodes,
        labels,
        relationships
      });
    } finally {
      await session.close();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    if (driver) {
      await driver.close();
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', serverTime: new Date() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  Graphora Express Engine is running!`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    - POST http://localhost:${PORT}/api/upload`);
  console.log(`    - GET  http://localhost:${PORT}/api/logs`);
  console.log(`    - POST http://localhost:${PORT}/api/logs/clear`);
  console.log(`=================================================`);
});
