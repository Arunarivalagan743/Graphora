import { NEO4J_PASSWORD, NEO4J_URI, NEO4J_USERNAME, UPLOAD_BATCH_BYTES, UPLOAD_MAX_BYTES, UPLOAD_MAX_ROWS, UPLOAD_MIN_BYTES } from '../config.js';
import { createNeo4jDriver, writeNeo4jBatch } from '../services/neo4jService.js';
import { estimateRowBytes, parseJsonHeader, safeDecodeURIComponent } from '../utils/helpers.js';
import { schemaCacheManager } from '../ai/cache/schemaCache.js';
import { callLLM } from '../ai/config/llm.js';
import csvParser from 'csv-parser';

const uploadLogs = [];

function createLogEntry({ neoUri, cleanLabel, nodes }) {
  return {
    id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    uri: neoUri,
    label: nodes && Array.isArray(nodes) && nodes.length > 0 ? 'Dynamic Schema' : cleanLabel,
    recordCount: 0,
    status: 'pending',
    error: null
  };
}

export async function uploadHandler(req, res) {
  const { uri, username, password, label, data, nodes, relationships } = req.body;
  const neoUri = (uri && String(uri).trim()) ? uri : NEO4J_URI;
  const neoUser = (username && String(username).trim()) ? username : NEO4J_USERNAME;
  const neoPass = (password && String(password).trim()) ? password : NEO4J_PASSWORD;
  const cleanLabel = (label || 'Record').replace(/[^a-zA-Z0-9]/g, '') || 'Record';
  const logEntry = createLogEntry({ neoUri, cleanLabel, nodes });

  if (!Array.isArray(data) || data.length === 0) {
    const errorMsg = 'Invalid request data: "data" must be a non-empty array of objects.';
    logEntry.status = 'failure';
    logEntry.error = errorMsg;
    uploadLogs.unshift(logEntry);
    return res.status(400).json({ success: false, error: errorMsg, logEntry });
  }

  let driver;
  try {
    driver = createNeo4jDriver({ uri: neoUri, username: neoUser, password: neoPass });
    await driver.verifyConnectivity();

    const session = driver.session();
    try {
      if (nodes && Array.isArray(nodes) && nodes.length > 0) {
        await session.executeWrite(async (tx) => {
          for (const nodeMap of nodes) {
            const { label: nodeLabel, idColumn, properties } = nodeMap;
            const cleanNodeLabel = nodeLabel.replace(/[^a-zA-Z0-9_]/g, '');
            if (!cleanNodeLabel || !idColumn) continue;

            const escIdCol = nodeMap.idColumn.replace(/`/g, '``');
            const setClauses = (properties || []).map((prop) => `n.\`${prop.replace(/`/g, '``')}\` = row.\`${prop.replace(/`/g, '``')}\``);
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

            await tx.run(nodeQuery, { rows: data });
          }

          if (relationships && Array.isArray(relationships)) {
            for (const relMap of relationships) {
              const { sourceNodeId, type: relType, targetNodeId, properties } = relMap;
              if (!relType) continue;

              const sourceNode = nodes.find((n) => n.id === sourceNodeId);
              const targetNode = nodes.find((n) => n.id === targetNodeId);
              if (!sourceNode || !targetNode) continue;

              const cleanSourceLabel = sourceNode.label.replace(/[^a-zA-Z0-9_]/g, '');
              const cleanTargetLabel = targetNode.label.replace(/[^a-zA-Z0-9_]/g, '');
              const cleanRelType = relType.replace(/[^a-zA-Z0-9_]/g, '');
              if (!cleanSourceLabel || !cleanTargetLabel || !cleanRelType) continue;

              const escSrcIdCol = sourceNode.idColumn.replace(/`/g, '``');
              const escTgtIdCol = targetNode.idColumn.replace(/`/g, '``');
              const setClauses = (properties || []).map((prop) => `r.\`${prop.replace(/`/g, '``')}\` = row.\`${prop.replace(/`/g, '``')}\``);
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

              await tx.run(relQuery, { rows: data });
            }
          }
        });

        logEntry.status = 'success';
        uploadLogs.unshift(logEntry);
        schemaCacheManager.refreshCache({ uri: neoUri, username: neoUser, password: neoPass }).catch(() => { });
        return res.status(200).json({ success: true, message: 'Successfully uploaded nodes and relationships dynamically using schema mapping.', logEntry });
      }

      const escCleanLabel = cleanLabel.replace(/`/g, '``');
      const cypherQuery = `
        UNWIND $rows AS row
        CREATE (n:\`${escCleanLabel}\`)
        SET n = row
      `;

      await session.executeWrite((tx) => tx.run(cypherQuery, { rows: data }));
      logEntry.status = 'success';
      uploadLogs.unshift(logEntry);
      schemaCacheManager.refreshCache({ uri: neoUri, username: neoUser, password: neoPass }).catch(() => { });
      return res.status(200).json({ success: true, message: `Successfully uploaded ${data.length} nodes to Neo4j database under label :${cleanLabel}`, logEntry });
    } finally {
      await session.close();
    }
  } catch (err) {
    logEntry.status = 'failure';
    logEntry.error = err.message || 'Database transaction failed.';
    uploadLogs.unshift(logEntry);
    return res.status(500).json({ success: false, error: err.message || 'An error occurred during connection or database insert.', logEntry });
  } finally {
    if (driver) await driver.close();
  }
}

export async function uploadStreamHandler(req, res) {
  const rawLabel = safeDecodeURIComponent(req.header('x-graphora-label') || 'Record');
  const nodes = parseJsonHeader(req.header('x-graphora-nodes'), []);
  const relationships = parseJsonHeader(req.header('x-graphora-relationships'), []);

  const neoUri = NEO4J_URI;
  const neoUser = NEO4J_USERNAME;
  const neoPass = NEO4J_PASSWORD;
  const cleanLabel = (rawLabel || 'Record').replace(/[^a-zA-Z0-9]/g, '') || 'Record';
  const logEntry = createLogEntry({ neoUri, cleanLabel, nodes });

  let driver;
  try {
    driver = createNeo4jDriver({ uri: neoUri, username: neoUser, password: neoPass });
    await driver.verifyConnectivity();
    const session = driver.session();

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    try { res.write(JSON.stringify({ type: 'start', id: logEntry.id, label: logEntry.label }) + '\n'); } catch (e) { }

    const parser = csvParser({
      mapValues: ({ value }) => {
        if (value === '') return null;
        const num = Number(value);
        if (!isNaN(num) && String(num).trim() === String(value).trim()) return num;
        return value;
      },
      skipLines: 0
    });

    const initialTargetBytes = UPLOAD_BATCH_BYTES;
    const minimumTargetBytes = UPLOAD_MIN_BYTES;
    const maximumTargetBytes = UPLOAD_MAX_BYTES;
    const maximumRows = UPLOAD_MAX_ROWS;

    let batchRows = [];
    let batchBytes = 0;
    let targetBytes = initialTargetBytes;
    let processedRows = 0;
    let activeFlush = Promise.resolve();
    let finished = false;

    const flushBatch = async (rowsToFlush, bytesToFlush) => {
      if (!rowsToFlush || rowsToFlush.length === 0) return;
      const started = Date.now();
      await session.executeWrite(async (tx) => {
        await writeNeo4jBatch(tx, rowsToFlush, nodes, relationships, cleanLabel);
      });
      processedRows += rowsToFlush.length;
      const durationMs = Date.now() - started;
      if (durationMs < 400 && bytesToFlush >= targetBytes * 0.8) {
        targetBytes = Math.min(Math.round(targetBytes * 1.2), maximumTargetBytes);
      } else if (durationMs > 1200 || bytesToFlush > targetBytes * 1.1) {
        targetBytes = Math.max(Math.round(targetBytes * 0.8), minimumTargetBytes);
      }
      try { res.write(JSON.stringify({ type: 'batch', rows: rowsToFlush.length, bytes: bytesToFlush, processedRows, durationMs }) + '\n'); } catch (e) { }
    };

    const stopWithError = (err, reject) => {
      if (finished) return;
      finished = true;
      reject(err);
      try { req.destroy(err); } catch { }
    };

    await new Promise((resolve, reject) => {
      parser.on('data', (row) => {
        batchRows.push(row);
        batchBytes += estimateRowBytes(row);

        if (batchRows.length >= maximumRows || batchBytes >= targetBytes) {
          const rowsToFlush = batchRows;
          const bytesToFlush = batchBytes;
          batchRows = [];
          batchBytes = 0;
          req.pause();
          activeFlush = activeFlush
            .then(() => flushBatch(rowsToFlush, bytesToFlush))
            .then(() => {
              if (!finished) req.resume();
            })
            .catch((err) => stopWithError(err, reject));
        }
      });

      parser.on('end', () => {
        activeFlush = activeFlush.then(async () => {
          if (batchRows.length > 0) {
            const rowsToFlush = batchRows;
            const bytesToFlush = batchBytes;
            batchRows = [];
            batchBytes = 0;
            await flushBatch(rowsToFlush, bytesToFlush);
          }
        });

        activeFlush.then(() => {
          if (!finished) {
            finished = true;
            resolve();
          }
        }).catch((err) => stopWithError(err, reject));
      });

      parser.on('error', (err) => stopWithError(err, reject));
      req.on('error', (err) => stopWithError(err, reject));
      req.pipe(parser);
    });

    logEntry.status = 'success';
    logEntry.recordCount = processedRows;
    uploadLogs.unshift(logEntry);
    schemaCacheManager.refreshCache({ uri: neoUri, username: neoUser, password: neoPass }).catch(() => { });

    try { res.write(JSON.stringify({ type: 'done', success: true, message: `Successfully streamed ${processedRows} rows to Neo4j using adaptive batches.`, processedRows }) + '\n'); } catch (e) { }
    try { res.end(); } catch (e) { }
    return;
  } catch (err) {
    logEntry.status = 'failure';
    logEntry.error = err.message || 'Streaming upload failed.';
    uploadLogs.unshift(logEntry);
    try { res.write(JSON.stringify({ type: 'error', error: err.message || 'Streaming upload failed.' }) + '\n'); } catch (e) { }
    try { res.end(); } catch (e) { }
    return;
  } finally {
    if (driver) await driver.close();
  }
}

export function getLogsHandler(req, res) {
  res.status(200).json({ success: true, logs: uploadLogs });
}

export function clearLogsHandler(req, res) {
  uploadLogs.length = 0;
  res.status(200).json({ success: true, message: 'Upload logs cleared successfully.' });
}

export async function clearNodesHandler(req, res) {
  const { label } = req.body;
  const neoUri = NEO4J_URI;
  const neoUser = NEO4J_USERNAME;
  const neoPass = NEO4J_PASSWORD;

  let driver;
  try {
    driver = createNeo4jDriver({ uri: neoUri, username: neoUser, password: neoPass });
    await driver.verifyConnectivity();
    const session = driver.session();
    try {
      let cypherQuery = '';
      let message = '';

      if (label && label !== '*') {
        const cleanLabel = label.replace(/[^a-zA-Z0-9_]/g, '');
        cypherQuery = `MATCH (n:\`${cleanLabel}\`) DETACH DELETE n`;
        message = `Successfully deleted all nodes under label :${cleanLabel}`;
        await session.executeWrite((tx) => tx.run(cypherQuery));
      } else {
        await session.executeWrite((tx) => tx.run('MATCH (n) DETACH DELETE n'));
        try {
          const constraintsRes = await session.run('SHOW CONSTRAINTS YIELD name');
          for (const record of constraintsRes.records) {
            const constraintName = record.get('name');
            if (constraintName) await session.run(`DROP CONSTRAINT \`${constraintName}\` IF EXISTS`);
          }
        } catch (e) { }
        try {
          const indexesRes = await session.run('SHOW INDEXES YIELD name');
          for (const record of indexesRes.records) {
            const indexName = record.get('name');
            if (indexName && !indexName.startsWith('LOOKUP')) await session.run(`DROP INDEX \`${indexName}\` IF EXISTS`);
          }
        } catch (e) { }
        message = 'Successfully wiped all nodes, relationships, indexes, and constraints from the database.';
      }

      schemaCacheManager.refreshCache({ uri: neoUri, username: neoUser, password: neoPass }).catch(() => { });
      return res.status(200).json({ success: true, message });
    } finally {
      await session.close();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete database nodes.' });
  } finally {
    if (driver) await driver.close();
  }
}

export async function generateSchemaHandler(req, res) {
  const { headers, data: sampleData } = req.body;

  if (!headers || !Array.isArray(headers) || headers.length === 0) return res.status(400).json({ success: false, error: 'Headers are required for schema generation.' });

  const systemPrompt = `You are an expert Neo4j graph data modeler.

Analyze the provided CSV headers and sample dataset rows. Return strictly valid JSON only.

INSTRUCTIONS FOR GRAPH SCHEMA GENERATION:
1. Identify the primary entity (e.g. Case, Employee, Order, Invoice, Product).
2. Identify distinct secondary nodes for categorical attributes, statuses, locations, or related entities (e.g. Status, Department, City, Category, Flag, Company).
3. CRITICAL: Every node's "primaryKey" MUST BE AN EXACT CASE-SENSITIVE STRING MATCH to one of the provided CSV Headers! Do NOT invent new header names like "Case ID" if the header is "case_no".
4. Define relationship links connecting the primary entity node to secondary nodes (e.g. Case -> HAS_STATUS -> Status, Case -> HAS_FLAG -> Flag).
5. Always return at least 2 distinct node labels and at least 1 relationship type so Neo4j displays a connected graph network with relationships.
6. Return strictly valid JSON matching this exact structure:
{
  "nodes": [
    { "label": "Case", "primaryKey": "case_no", "properties": ["case_no", "filed_date", "closed_date"] },
    { "label": "Status", "primaryKey": "status", "properties": ["status"] }
  ],
  "relationships": [
    { "source": "Case", "target": "Status", "type": "HAS_STATUS" }
  ]
}`;

  const userPrompt = `CSV Headers: ${headers.join(', ')}\n\nSample Data (JSON format):\n${JSON.stringify(sampleData || [], null, 2)}`;

  try {
    const rawResponse = await callLLM({ systemPrompt, userPrompt, temperature: 0.1, jsonMode: true });
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    const cleanedJson = jsonMatch ? jsonMatch[0] : rawResponse;
    const schema = JSON.parse(cleanedJson);
    return res.status(200).json({ success: true, schema });
  } catch (err) {
    console.error('Failed to generate schema via LLM:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to generate schema.' });
  }
}

export async function dbDiagnosticsHandler(req, res) {
  const neoUri = NEO4J_URI;
  const neoUser = NEO4J_USERNAME;
  const neoPass = NEO4J_PASSWORD;

  let driver;
  try {
    driver = createNeo4jDriver({ uri: neoUri, username: neoUser, password: neoPass });
    await driver.verifyConnectivity();
    const session = driver.session();
    try {
      const labelsRes = await session.run('MATCH (n) RETURN labels(n) AS labels, count(n) AS count');
      const labels = labelsRes.records.map((r) => ({ labels: r.get('labels'), count: r.get('count').toNumber() }));
      const relsRes = await session.run('MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count');
      const relationships = relsRes.records.map((r) => ({ type: r.get('type'), count: r.get('count').toNumber() }));
      const totalNodesRes = await session.run('MATCH (n) RETURN count(n) AS count');
      const totalNodes = totalNodesRes.records[0].get('count').toNumber();
      return res.status(200).json({ success: true, totalNodes, labels, relationships });
    } finally {
      await session.close();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    if (driver) await driver.close();
  }
}

export function healthHandler(req, res) {
  res.status(200).json({ status: 'ok', serverTime: new Date() });
}
