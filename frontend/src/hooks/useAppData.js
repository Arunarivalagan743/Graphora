import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseCSVFile } from '../utils/csvParser';
import { buildCsvText, createEmptyManualRow, getPrimaryKeyColumn, headersMatch } from '../utils/appHelpers';

const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://graphora.onrender.com');

export default function useAppData() {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('data-viewer');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedStatusTab, setSelectedStatusTab] = useState('All');
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const [schemaMessage, setSchemaMessage] = useState('');
  const [nodesMapping, setNodesMapping] = useState([]);
  const [relationshipsMapping, setRelationshipsMapping] = useState([]);
  const [manualRowDraft, setManualRowDraft] = useState({});
  const [neo4jLabel, setNeo4jLabel] = useState('Record');
  const [neo4jStatus, setNeo4jStatus] = useState('');
  const [neo4jStatusMessage, setNeo4jStatusMessage] = useState('');
  const [neo4jStreaming, setNeo4jStreaming] = useState(false);
  const [neo4jProgress, setNeo4jProgress] = useState({ processedRows: 0 });
  const [neo4jBatches, setNeo4jBatches] = useState([]);
  const [dbDiagnostics, setDbDiagnostics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const mainFileInputRef = useRef(null);

  const fetchDiagnosticsAndLogs = useCallback(async () => {
    try {
      const [diagRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/db-diagnostics`),
        fetch(`${API_BASE_URL}/api/logs`)
      ]);

      if (diagRes.ok) {
        const diagData = await diagRes.json();
        if (diagData.success) setDbDiagnostics(diagData);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.success) setLogs(logsData.logs || []);
      }
    } catch (e) {
      console.log('Failed to fetch diagnostics/logs:', e);
    }
  }, []);

  useEffect(() => {
    fetchDiagnosticsAndLogs();
  }, [fetchDiagnosticsAndLogs]);

  const parseCSV = useCallback(async (file) => {
    if (!file) return;

    setError(null);
    setSelectedRows(new Set());
    setCurrentPage(1);

    try {
      const { rows, headers: parsedHeaders, fileInfo: parsedFileInfo } = await parseCSVFile(file);
      const parsedHeadersNorm = parsedHeaders.map((h) => String(h || '').trim());

      const normalizeRows = (rawRows, rawHeaders) => rawRows.map((r) => {
        const normalized = {};
        parsedHeadersNorm.forEach((h, i) => {
          const rawKey = rawHeaders[i] ?? h;
          normalized[h] = r[rawKey] !== undefined ? r[rawKey] : (r[h] !== undefined ? r[h] : '');
        });
        return normalized;
      });

      const normalizedRows = normalizeRows(rows, parsedHeaders);

      if (!headers || headers.length === 0 || data.length === 0) {
        setHeaders(parsedHeadersNorm);
        setData(normalizedRows.map((r) => ({ ...r, _origin: 'csv' })));
        setFileInfo(parsedFileInfo);
        setManualRowDraft(createEmptyManualRow(parsedHeadersNorm));
        setSchemaMessage('CSV loaded. Generate graph schema manually from the Graph Schema tab when ready.');
        return;
      }

      if (headersMatch(headers, parsedHeadersNorm)) {
        const primaryKey = getPrimaryKeyColumn(nodesMapping, parsedHeadersNorm) || parsedHeadersNorm[0];

        setData((prev) => {
          const merged = [...prev];
          const existingMap = new Map();
          merged.forEach((r, idx) => {
            const origin = r && r._origin ? r._origin : 'csv';
            const raw = r[primaryKey];
            const key = raw !== undefined && raw !== null ? String(raw) : `__idx_${idx}`;
            if (origin === 'csv') existingMap.set(key, idx);
          });

          let updatedCount = 0;
          let appendedCount = 0;

          normalizedRows.forEach((nr) => {
            const raw = nr[primaryKey];
            const key = raw !== undefined && raw !== null && String(raw).trim() !== '' ? String(raw) : null;
            if (key && existingMap.has(key)) {
              const idx = existingMap.get(key);
              merged[idx] = { ...merged[idx], ...nr, _origin: 'csv' };
              updatedCount += 1;
            } else {
              merged.push({ ...nr, _origin: 'csv' });
              appendedCount += 1;
            }
          });

          setFileInfo((prevFi) => ({
            ...(prevFi || parsedFileInfo),
            name: 'Combined CSV',
            rowCount: merged.length,
            columnCount: parsedHeadersNorm.length
          }));
          setManualRowDraft(createEmptyManualRow(parsedHeadersNorm));
          setCurrentPage(Math.max(1, Math.ceil(merged.length / pageSize)));

          let msg = '';
          if (updatedCount > 0 && appendedCount > 0) {
            msg = `${updatedCount} rows updated, ${appendedCount} new rows appended.`;
          } else if (updatedCount > 0) {
            msg = `${updatedCount} rows updated.`;
          } else if (appendedCount > 0) {
            msg = `${appendedCount} new rows appended.`;
          } else {
            msg = 'No changes detected from the uploaded CSV.';
          }
          setSchemaMessage(`${msg} Export when ready.`);
          return merged;
        });
        return;
      }

      setError('CSV headers do not match the current dataset. Clear the data first or upload a CSV with the same headers to append.');
    } catch (err) {
      setError(err.message || 'Error parsing CSV file.');
    }
  }, [data.length, headers, nodesMapping, pageSize]);

  const generateGraphSchema = useCallback(async (cols = headers, sampleData = data.slice(0, 5)) => {
    if (!cols || cols.length === 0) {
      setError('Please upload a CSV file with valid headers first.');
      return;
    }

    setIsGeneratingSchema(true);
    setSchemaMessage('Analyzing uploaded CSV headers & data structure...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: cols, data: sampleData })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to generate graph schema.');
      }

      const { schema } = resData;
      const createdNodes = (schema.nodes || []).map((n, idx) => {
        const nodeId = `node_${idx + 1}_${Date.now()}`;
        let matchedCol = cols.find((c) => c.toLowerCase() === (n.primaryKey || '').toLowerCase());
        if (!matchedCol) {
          matchedCol = cols.find((c) => c.toLowerCase().includes('id') || c.toLowerCase().includes('no') || c.toLowerCase().includes('code')) || cols[idx] || cols[0];
        }
        return {
          id: nodeId,
          label: n.label || `Node_${idx + 1}`,
          idColumn: matchedCol,
          properties: (n.properties || cols).filter((p) => cols.includes(p))
        };
      });

      if (createdNodes.length === 0) {
        createdNodes.push({
          id: `node_1_${Date.now()}`,
          label: 'Record',
          idColumn: cols[0] || '',
          properties: cols
        });
      }

      if (createdNodes.length === 1 && cols.length > 1) {
        const secondaryCol = cols.find((c, i) => i > 0 && typeof sampleData?.[0]?.[c] === 'string') || cols[1];
        if (secondaryCol) {
          const secondNodeId = `node_2_${Date.now()}`;
          const secondLabel = secondaryCol.charAt(0).toUpperCase() + secondaryCol.slice(1).replace(/[^a-zA-Z0-9]/g, '');
          createdNodes.push({
            id: secondNodeId,
            label: secondLabel,
            idColumn: secondaryCol,
            properties: [secondaryCol]
          });
        }
      }

      let createdRels = (schema.relationships || []).map((r, idx) => {
        const srcNode = createdNodes.find((n) => n.label.toLowerCase() === (r.source || '').toLowerCase()) || createdNodes[0];
        let tgtNode = createdNodes.find((n) => n.label.toLowerCase() === (r.target || '').toLowerCase());
        if (!tgtNode || tgtNode.id === srcNode.id) {
          tgtNode = createdNodes.find((n) => n.id !== srcNode.id) || srcNode;
        }

        return {
          id: `rel_${idx + 1}_${Date.now()}`,
          sourceNodeId: srcNode.id,
          targetNodeId: tgtNode.id,
          type: (r.type || `HAS_${tgtNode.label.toUpperCase()}`).toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          properties: []
        };
      });

      if (createdNodes.length >= 2 && createdRels.length === 0) {
        createdRels = [{
          id: `rel_1_${Date.now()}`,
          sourceNodeId: createdNodes[0].id,
          targetNodeId: createdNodes[1].id,
          type: `HAS_${createdNodes[1].label.toUpperCase()}`,
          properties: []
        }];
      }

      setNodesMapping(createdNodes);
      setRelationshipsMapping(createdRels);
      setSchemaMessage(`Graph schema dynamically structured ${createdNodes.length} node types & ${createdRels.length} relationship types from your CSV.`);
    } catch (err) {
      console.error('Schema Generation Error:', err);
      setSchemaMessage(`Notice: Dynamic schema fallback active (${err.message})`);

      const defaultNodeId = `node_1_${Date.now()}`;
      const secondNodeId = `node_2_${Date.now()}`;
      const secCol = cols[1] || cols[0];

      const fallbackNodes = [
        { id: defaultNodeId, label: 'Record', idColumn: cols[0] || '', properties: cols },
        { id: secondNodeId, label: secCol.charAt(0).toUpperCase() + secCol.slice(1).replace(/[^a-zA-Z0-9]/g, ''), idColumn: secCol, properties: [secCol] }
      ];

      setNodesMapping(fallbackNodes);
      setRelationshipsMapping([{ id: `rel_1_${Date.now()}`, sourceNodeId: defaultNodeId, targetNodeId: secondNodeId, type: `HAS_${secCol.toUpperCase()}`, properties: [] }]);
    } finally {
      setIsGeneratingSchema(false);
    }
  }, [data, headers]);

  const handleManualRowChange = useCallback((column, value) => {
    setManualRowDraft((prev) => ({ ...prev, [column]: value }));
  }, []);

  const addManualRow = useCallback(() => {
    if (!headers || headers.length === 0) {
      setError('Upload a CSV first so manual rows can use the same headers.');
      return;
    }

    const hasValue = headers.some((header) => String(manualRowDraft[header] ?? '').trim() !== '');
    if (!hasValue) {
      setError('Enter at least one value before adding a manual row.');
      return;
    }

    const nextRow = headers.reduce((acc, header) => {
      acc[header] = manualRowDraft[header] ?? '';
      return acc;
    }, {});

    setData((prev) => [...prev, { ...nextRow, _origin: 'manual' }]);
    setFileInfo((prev) => ({
      ...(prev || { name: 'Combined CSV', size: '', rowCount: 0, columnCount: headers.length }),
      name: prev?.name && prev.name !== 'Combined CSV' ? 'Combined CSV' : (prev?.name || 'Combined CSV'),
      rowCount: (prev?.rowCount || data.length) + 1,
      columnCount: headers.length
    }));
    setManualRowDraft(createEmptyManualRow(headers));
    setSelectedRows(new Set());
    setCurrentPage(Math.max(1, Math.ceil((data.length + 1) / pageSize)));
    setSchemaMessage('Manual row added. Export to Neo4j to update the graph.');
    setError(null);
  }, [data.length, headers, manualRowDraft, pageSize]);

  const addNodeMapping = useCallback(() => {
    const newId = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setNodesMapping((prev) => [
      ...prev,
      { id: newId, label: `Node_${prev.length + 1}`, idColumn: headers[0] || '', properties: [...headers] }
    ]);
  }, [headers]);

  const deleteNodeMapping = useCallback((nodeId) => {
    setNodesMapping((prev) => prev.filter((n) => n.id !== nodeId));
    setRelationshipsMapping((prev) => prev.filter((r) => r.sourceNodeId !== nodeId && r.targetNodeId !== nodeId));
  }, []);

  const toggleNodeProperty = useCallback((nodeId, column) => {
    setNodesMapping((prev) => prev.map((n) => {
      if (n.id !== nodeId) return n;
      const hasProp = n.properties.includes(column);
      return { ...n, properties: hasProp ? n.properties.filter((p) => p !== column) : [...n.properties, column] };
    }));
  }, []);

  const addRelationshipMapping = useCallback(() => {
    if (nodesMapping.length < 2) {
      alert('You need at least 2 nodes to establish a relationship mapping.');
      return;
    }
    const newId = 'rel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setRelationshipsMapping((prev) => [
      ...prev,
      { id: newId, sourceNodeId: nodesMapping[0].id, targetNodeId: nodesMapping[1].id, type: 'RELATED_TO', properties: [] }
    ]);
  }, [nodesMapping]);

  const deleteRelationshipMapping = useCallback((relId) => {
    setRelationshipsMapping((prev) => prev.filter((r) => r.id !== relId));
  }, []);

  const toggleRelationshipProperty = useCallback((relId, column) => {
    setRelationshipsMapping((prev) => prev.map((r) => {
      if (r.id !== relId) return r;
      const properties = r.properties || [];
      const hasProp = properties.includes(column);
      return { ...r, properties: hasProp ? properties.filter((p) => p !== column) : [...properties, column] };
    }));
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseCSV(e.dataTransfer.files[0]);
    }
  }, [parseCSV]);

  const handleFileUpload = useCallback((e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) parseCSV(uploadedFile);
  }, [parseCSV]);

  const resetAll = useCallback(() => {
    setData([]);
    setManualRowDraft({});
    setHeaders([]);
    setFileInfo(null);
    setError(null);
    setSearch('');
    setSelectedRows(new Set());
    setNodesMapping([]);
    setRelationshipsMapping([]);
    setNeo4jStatus('');
    setNeo4jStatusMessage('');
  }, []);

  const saveToNeo4j = useCallback(async () => {
    if (!data || data.length === 0) {
      setNeo4jStatus('error');
      setNeo4jStatusMessage('No CSV data uploaded to export.');
      return;
    }

    setNeo4jStatus('loading');
    setNeo4jStatusMessage('Streaming CSV to Neo4j in adaptive batches...');
    setNeo4jStreaming(true);
    setNeo4jProgress({ processedRows: 0 });
    setNeo4jBatches([]);

    try {
      const csvText = buildCsvText(headers, data);
      const csvBlob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });

      const response = await fetch(`${API_BASE_URL}/api/upload-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'X-Graphora-Label': encodeURIComponent(neo4jLabel),
          'X-Graphora-Nodes': encodeURIComponent(JSON.stringify(nodesMapping.length > 0 ? nodesMapping : [])),
          'X-Graphora-Relationships': encodeURIComponent(JSON.stringify(relationshipsMapping.length > 0 ? relationshipsMapping : []))
        },
        body: csvBlob
      });

      if (!response.body) {
        throw new Error('Streaming not supported by this browser or server did not return a stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let localBatches = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line || !line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'batch') {
              localBatches += 1;
              setNeo4jProgress((prev) => ({ ...prev, processedRows: evt.processedRows }));
              setNeo4jBatches((prev) => [...prev, { rows: evt.rows, bytes: evt.bytes, durationMs: evt.durationMs }]);
            } else if (evt.type === 'done') {
              setNeo4jProgress((prev) => ({ ...prev, processedRows: evt.processedRows || prev.processedRows }));
              setNeo4jStatus('success');
              const batchNote = localBatches > 0 ? ` (Batches: ${localBatches})` : '';
              setNeo4jStatusMessage((evt.message || `Successfully streamed ${evt.processedRows || data.length} rows into Neo4j.`) + batchNote);
              setNeo4jStreaming(false);
              fetchDiagnosticsAndLogs();
            } else if (evt.type === 'error') {
              setNeo4jStatus('error');
              setNeo4jStatusMessage(evt.error || 'Error during streaming upload.');
              setNeo4jStreaming(false);
            }
          } catch (e) {
            console.warn('Failed to parse streaming line', e, line);
          }
        }
      }

      if (buffer && buffer.trim()) {
        try {
          const evt = JSON.parse(buffer.trim());
          if (evt.type === 'done') {
            setNeo4jProgress((prev) => ({ ...prev, processedRows: evt.processedRows || prev.processedRows }));
            setNeo4jStatus('success');
            const batchNote = localBatches > 0 ? ` (Batches: ${localBatches})` : '';
            setNeo4jStatusMessage((evt.message || `Successfully streamed ${evt.processedRows || data.length} rows into Neo4j.`) + batchNote);
            setNeo4jStreaming(false);
            fetchDiagnosticsAndLogs();
          } else if (evt.type === 'error') {
            setNeo4jStatus('error');
            setNeo4jStatusMessage(evt.error || 'Error during streaming upload.');
            setNeo4jStreaming(false);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error('Neo4j Stream Export Error:', err);
      setNeo4jStatus('error');
      setNeo4jStatusMessage(err.message || 'Error occurred during Neo4j stream sync.');
      setNeo4jStreaming(false);
    }
  }, [data, fetchDiagnosticsAndLogs, headers, neo4jLabel, nodesMapping, relationshipsMapping]);

  const clearNeo4jNodes = useCallback(async (targetLabel = neo4jLabel, wipeLocal = false) => {
    const confirmMsg = targetLabel === '*'
      ? 'Are you sure you want to wipe all nodes and relationships from your Neo4j database?'
      : `Delete all nodes under label :${targetLabel}?`;

    if (!window.confirm(confirmMsg)) return false;

    setNeo4jStatus('loading');
    setNeo4jStatusMessage(`Clearing Neo4j database nodes (${targetLabel})...`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/clear-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: targetLabel })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to clear nodes.');
      }

      setNeo4jStatus('success');
      setNeo4jStatusMessage(resData.message || 'Nodes cleared successfully.');
      if (wipeLocal && targetLabel === '*') {
        setData([]);
        setHeaders([]);
        setFileInfo(null);
        setManualRowDraft({});
        setNodesMapping([]);
        setRelationshipsMapping([]);
        setSelectedRows(new Set());
        setSearch('');
      }
      fetchDiagnosticsAndLogs();
      return true;
    } catch (err) {
      setNeo4jStatus('error');
      setNeo4jStatusMessage(err.message || 'Failed to clear nodes.');
      return false;
    }
  }, [fetchDiagnosticsAndLogs, neo4jLabel]);

  const cleanAndSaveToNeo4j = useCallback(async () => {
    if (!data || data.length === 0) {
      setNeo4jStatus('error');
      setNeo4jStatusMessage('No CSV data uploaded to export.');
      return;
    }

    // 1. Wipe existing DB nodes first without erasing local CSV
    setNeo4jStatus('loading');
    setNeo4jStatusMessage('Wiping old database nodes for clean schema update...');

    try {
      const clearRes = await fetch(`${API_BASE_URL}/api/clear-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '*' })
      });
      if (!clearRes.ok) throw new Error('Failed to wipe old database nodes.');
    } catch (e) {
      console.warn('Wipe warning during clean re-export:', e.message);
    }

    // 2. Export updated schema & CSV rows
    await saveToNeo4j();
  }, [data, saveToNeo4j]);

  const statusColumn = useMemo(() => headers.find((h) => h.toLowerCase() === 'status') || null, [headers]);

  const statusTabsList = useMemo(() => {
    if (!statusColumn || data.length === 0) return [];
    const counts = {};
    data.forEach((row) => {
      const val = String(row[statusColumn] || 'Unknown').trim();
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.keys(counts).map((key) => ({ name: key, count: counts[key] }));
  }, [data, statusColumn]);

  const filteredData = useMemo(() => {
    let result = data;

    if (statusColumn && selectedStatusTab !== 'All') {
      result = result.filter((row) => String(row[statusColumn]).toLowerCase().trim() === selectedStatusTab.toLowerCase().trim());
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter((row) => Object.values(row).some((val) => val !== null && val !== undefined && String(val).toLowerCase().includes(query)));
    }

    return result;
  }, [data, search, selectedStatusTab, statusColumn]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const { key, asc } = sort;
    return [...filteredData].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return asc ? valA - valB : valB - valA;
      }
      return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sort]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedData]);

  const handleSort = useCallback((colKey) => {
    setSort((prev) => {
      if (prev && prev.key === colKey) {
        return prev.asc ? { key: colKey, asc: false } : null;
      }
      return { key: colKey, asc: true };
    });
  }, []);

  const handleSelectAll = useCallback((e) => {
    if (e.target.checked) {
      const nextSet = new Set(selectedRows);
      paginatedData.forEach((_, idx) => nextSet.add(idx + (currentPage - 1) * pageSize));
      setSelectedRows(nextSet);
    } else {
      const nextSet = new Set(selectedRows);
      paginatedData.forEach((_, idx) => nextSet.delete(idx + (currentPage - 1) * pageSize));
      setSelectedRows(nextSet);
    }
  }, [currentPage, paginatedData, selectedRows]);

  const handleSelectRow = useCallback((globalIdx) => {
    const nextSet = new Set(selectedRows);
    if (nextSet.has(globalIdx)) nextSet.delete(globalIdx);
    else nextSet.add(globalIdx);
    setSelectedRows(nextSet);
  }, [selectedRows]);

  return {
    data,
    headers,
    fileInfo,
    error,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    sort,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    selectedRows,
    selectedStatusTab,
    setSelectedStatusTab,
    isGeneratingSchema,
    schemaMessage,
    nodesMapping,
    setNodesMapping,
    relationshipsMapping,
    setRelationshipsMapping,
    manualRowDraft,
    neo4jLabel,
    setNeo4jLabel,
    neo4jStatus,
    neo4jStatusMessage,
    neo4jStreaming,
    neo4jProgress,
    neo4jBatches,
    dbDiagnostics,
    logs,
    isDragActive,
    setIsDragActive,
    mainFileInputRef,
    parseCSV,
    generateGraphSchema,
    handleManualRowChange,
    addManualRow,
    addNodeMapping,
    deleteNodeMapping,
    toggleNodeProperty,
    addRelationshipMapping,
    deleteRelationshipMapping,
    toggleRelationshipProperty,
    handleDrag,
    handleDrop,
    handleFileUpload,
    resetAll,
    saveToNeo4j,
    cleanAndSaveToNeo4j,
    clearNeo4jNodes,
    statusTabsList,
    filteredData,
    sortedData,
    paginatedData,
    totalPages,
    handleSort,
    handleSelectAll,
    handleSelectRow,
    fetchDiagnosticsAndLogs,
  };
}
