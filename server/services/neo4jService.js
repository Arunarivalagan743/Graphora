import neo4j from 'neo4j-driver';
import { NEO4J_PASSWORD, NEO4J_URI, NEO4J_USERNAME } from '../config.js';
import { escapeIdentifier } from '../utils/helpers.js';

export function createNeo4jDriver({ uri = NEO4J_URI, username = NEO4J_USERNAME, password = NEO4J_PASSWORD } = {}) {
  return neo4j.driver(uri, neo4j.auth.basic(username, password));
}

export async function writeNeo4jBatch(tx, rows, nodes, relationships, cleanLabel) {
  if (nodes && Array.isArray(nodes) && nodes.length > 0) {
    for (const nodeMap of nodes) {
      const { label: nodeLabel, idColumn, properties } = nodeMap;
      if (!nodeLabel || !idColumn) {
        continue;
      }

      const cleanNodeLabel = nodeLabel.replace(/[^a-zA-Z0-9_]/g, '');
      if (!cleanNodeLabel) {
        continue;
      }

      const escIdCol = escapeIdentifier(idColumn);
      const setClauses = (properties || []).map((prop) => {
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

      await tx.run(nodeQuery, { rows });
    }

    if (relationships && Array.isArray(relationships)) {
      for (const relMap of relationships) {
        const { sourceNodeId, type: relType, targetNodeId, properties } = relMap;
        if (!relType) {
          continue;
        }

        const sourceNode = nodes.find((n) => n.id === sourceNodeId);
        const targetNode = nodes.find((n) => n.id === targetNodeId);
        if (!sourceNode || !targetNode) {
          continue;
        }

        const cleanSourceLabel = sourceNode.label.replace(/[^a-zA-Z0-9_]/g, '');
        const cleanTargetLabel = targetNode.label.replace(/[^a-zA-Z0-9_]/g, '');
        const cleanRelType = relType.replace(/[^a-zA-Z0-9_]/g, '');

        if (!cleanSourceLabel || !cleanTargetLabel || !cleanRelType) {
          continue;
        }

        const escSrcIdCol = escapeIdentifier(sourceNode.idColumn);
        const escTgtIdCol = escapeIdentifier(targetNode.idColumn);

        const setClauses = (properties || []).map((prop) => {
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

        await tx.run(relQuery, { rows });
      }
    }

    return;
  }

  const escCleanLabel = escapeIdentifier(cleanLabel);
  const cypherQuery = `
    UNWIND $rows AS row
    CREATE (n:\`${escCleanLabel}\`)
    SET n = row
  `;

  await tx.run(cypherQuery, { rows });
}

export async function executeUploadRows({
  neoUri,
  neoUser,
  neoPass,
  label,
  data,
  nodes,
  relationships,
}) {
  const cleanLabel = (label || 'Record').replace(/[^a-zA-Z0-9]/g, '') || 'Record';

  let driver;
  try {
    driver = createNeo4jDriver({ uri: neoUri, username: neoUser, password: neoPass });
    await driver.verifyConnectivity();

    const session = driver.session();
    try {
      await session.executeWrite(async (tx) => {
        await writeNeo4jBatch(tx, data, nodes, relationships, cleanLabel);
      });
    } finally {
      await session.close();
    }

    return { cleanLabel };
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}
