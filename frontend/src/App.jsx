import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileSpreadsheet, GitFork, Plug, Database, AlertCircle } from 'lucide-react';

import Header from './components/Header';
import Dropzone from './components/Dropzone';
import DataExplorer from './components/DataExplorer';
import GraphSchemaBuilder from './components/GraphSchemaBuilder';
import Neo4jSync from './components/Neo4jSync';
import LogsDiagnostics from './components/LogsDiagnostics';
import Footer from './components/Footer';
import { parseCSVFile } from './utils/csvParser';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState(null);

  // Layout navigation: 'data-viewer' | 'graph-schema' | 'neo4j-sync' | 'logs'
  const [activeTab, setActiveTab] = useState('data-viewer');

  // Search and Sort
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(null); // { key: string, asc: boolean }

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Checkbox selection state
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Dynamic Status Tabs
  const [selectedStatusTab, setSelectedStatusTab] = useState('All');

  // Graph Schema Generator States
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const [schemaMessage, setSchemaMessage] = useState('');
  const [nodesMapping, setNodesMapping] = useState([]);
  const [relationshipsMapping, setRelationshipsMapping] = useState([]);

  // Neo4j Connection States
  const [neo4jLabel, setNeo4jLabel] = useState('Record');
  const [neo4jStatus, setNeo4jStatus] = useState(''); // 'loading' | 'success' | 'error'
  const [neo4jStatusMessage, setNeo4jStatusMessage] = useState('');

  // Diagnostics and Logs from server
  const [dbDiagnostics, setDbDiagnostics] = useState(null);
  const [logs, setLogs] = useState([]);

  // Drag and Drop State for empty dropzone
  const [isDragActive, setIsDragActive] = useState(false);
  const mainFileInputRef = useRef(null);

  // Parse CSV File Dynamically using csvParser utility
  const parseCSV = async (file) => {
    if (!file) return;

    setError(null);
    setSelectedRows(new Set());
    setCurrentPage(1);

    try {
      const { rows, headers: parsedHeaders, fileInfo: parsedFileInfo } = await parseCSVFile(file);
      setHeaders(parsedHeaders);
      setData(rows);
      setFileInfo(parsedFileInfo);

      // Automatically trigger Graph Schema Generation for the uploaded CSV
      generateGraphSchema(parsedHeaders, rows.slice(0, 5));
    } catch (err) {
      setError(err.message || 'Error parsing CSV file.');
    }
  };

  // Fetch DB diagnostics & execution logs from server on mount
  useEffect(() => {
    fetchDiagnosticsAndLogs();
  }, []);

  const fetchDiagnosticsAndLogs = async () => {
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
  };

  // Call Backend Graph Schema Generator API
  const generateGraphSchema = async (cols = headers, sampleData = data.slice(0, 5)) => {
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

      // Transform backend schema into frontend mapping objects with strict CSV header validation
      const createdNodes = (schema.nodes || []).map((n, idx) => {
        const nodeId = `node_${idx + 1}_${Date.now()}`;
        let matchedCol = cols.find(c => c.toLowerCase() === (n.primaryKey || '').toLowerCase());
        if (!matchedCol) {
          matchedCol = cols.find(c => c.toLowerCase().includes('id') || c.toLowerCase().includes('no') || c.toLowerCase().includes('code')) || cols[idx] || cols[0];
        }
        return {
          id: nodeId,
          label: n.label || `Node_${idx + 1}`,
          idColumn: matchedCol,
          properties: (n.properties || cols).filter(p => cols.includes(p))
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

      // If only 1 node was returned or categorical fields exist, auto-create secondary entity node
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
        const srcNode = createdNodes.find(n => n.label.toLowerCase() === (r.source || '').toLowerCase()) || createdNodes[0];
        let tgtNode = createdNodes.find(n => n.label.toLowerCase() === (r.target || '').toLowerCase());
        if (!tgtNode || tgtNode.id === srcNode.id) {
          tgtNode = createdNodes.find(n => n.id !== srcNode.id) || srcNode;
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
      setRelationshipsMapping([{
        id: `rel_1_${Date.now()}`,
        sourceNodeId: defaultNodeId,
        targetNodeId: secondNodeId,
        type: `HAS_${secCol.toUpperCase()}`,
        properties: []
      }]);
    } finally {
      setIsGeneratingSchema(false);
    }
  };

  // Node mapping modification handlers
  const addNodeMapping = () => {
    const newId = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setNodesMapping(prev => [
      ...prev,
      {
        id: newId,
        label: `Node_${prev.length + 1}`,
        idColumn: headers[0] || '',
        properties: [...headers]
      }
    ]);
  };

  const deleteNodeMapping = (nodeId) => {
    setNodesMapping(prev => prev.filter(n => n.id !== nodeId));
    setRelationshipsMapping(prev => prev.filter(r => r.sourceNodeId !== nodeId && r.targetNodeId !== nodeId));
  };

  const toggleNodeProperty = (nodeId, column) => {
    setNodesMapping(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const hasProp = n.properties.includes(column);
      return {
        ...n,
        properties: hasProp ? n.properties.filter(p => p !== column) : [...n.properties, column]
      };
    }));
  };

  const addRelationshipMapping = () => {
    if (nodesMapping.length < 2) {
      alert('You need at least 2 nodes to establish a relationship mapping.');
      return;
    }
    const newId = 'rel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setRelationshipsMapping(prev => [
      ...prev,
      {
        id: newId,
        sourceNodeId: nodesMapping[0].id,
        targetNodeId: nodesMapping[1].id,
        type: 'RELATED_TO',
        properties: []
      }
    ]);
  };

  const deleteRelationshipMapping = (relId) => {
    setRelationshipsMapping(prev => prev.filter(r => r.id !== relId));
  };

  const toggleRelationshipProperty = (relId, column) => {
    setRelationshipsMapping(prev => prev.map(r => {
      if (r.id !== relId) return r;
      const properties = r.properties || [];
      const hasProp = properties.includes(column);
      return {
        ...r,
        properties: hasProp ? properties.filter(p => p !== column) : [...properties, column]
      };
    }));
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseCSV(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) parseCSV(uploadedFile);
  };

  // Reset loaded CSV dataset completely
  const resetAll = () => {
    setData([]);
    setHeaders([]);
    setFileInfo(null);
    setError(null);
    setSearch('');
    setSelectedRows(new Set());
    setNodesMapping([]);
    setRelationshipsMapping([]);
    setNeo4jStatus('');
    setNeo4jStatusMessage('');
  };

  // Neo4j Database Export
  const saveToNeo4j = async () => {
    if (!data || data.length === 0) {
      setNeo4jStatus('error');
      setNeo4jStatusMessage('No CSV data uploaded to export.');
      return;
    }

    setNeo4jStatus('loading');
    setNeo4jStatusMessage('Connecting to Neo4j database and inserting graph nodes & relationships...');

    try {
      const payload = {
        label: neo4jLabel,
        data: data,
        nodes: nodesMapping.length > 0 ? nodesMapping : null,
        relationships: relationshipsMapping.length > 0 ? relationshipsMapping : null
      };

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to export to Neo4j.');
      }

      setNeo4jStatus('success');
      setNeo4jStatusMessage(resData.message || `Successfully loaded ${data.length} rows into Neo4j.`);
      fetchDiagnosticsAndLogs();
    } catch (err) {
      console.error('Neo4j Export Error:', err);
      setNeo4jStatus('error');
      setNeo4jStatusMessage(err.message || 'Error occurred during Neo4j sync.');
    }
  };

  // Clear Neo4j Nodes
  const clearNeo4jNodes = async (targetLabel = neo4jLabel) => {
    const confirmMsg = targetLabel === '*'
      ? 'Are you sure you want to wipe all nodes and relationships from your Neo4j database?'
      : `Delete all nodes under label :${targetLabel}?`;

    if (!window.confirm(confirmMsg)) return;

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
      setNeo4jStatusMessage(resData.message || `Nodes cleared successfully.`);
      if (targetLabel === '*') {
        setData([]);
        setHeaders([]);
        setFileInfo(null);
        setNodesMapping([]);
        setRelationshipsMapping([]);
        setSelectedRows(new Set());
        setSearch('');
      }
      fetchDiagnosticsAndLogs();
    } catch (err) {
      setNeo4jStatus('error');
      setNeo4jStatusMessage(err.message || 'Failed to clear nodes.');
    }
  };

  // Dynamic Status Tabs Calculation
  const statusColumn = useMemo(() => {
    return headers.find(h => h.toLowerCase() === 'status') || null;
  }, [headers]);

  const statusTabsList = useMemo(() => {
    if (!statusColumn || data.length === 0) return [];
    const counts = {};
    data.forEach(row => {
      const val = String(row[statusColumn] || 'Unknown').trim();
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
  }, [statusColumn, data]);

  // Dynamic Filtering Logic
  const filteredData = useMemo(() => {
    let result = data;

    if (statusColumn && selectedStatusTab !== 'All') {
      result = result.filter(row => String(row[statusColumn]).toLowerCase().trim() === selectedStatusTab.toLowerCase().trim());
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(row =>
        Object.values(row).some(val =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(query)
        )
      );
    }

    return result;
  }, [data, statusColumn, selectedStatusTab, search]);

  // Dynamic Sorting Logic
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
      return asc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sort]);

  // Pagination Slicing
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Sort toggle handler
  const handleSort = (colKey) => {
    setSort(prev => {
      if (prev && prev.key === colKey) {
        return prev.asc ? { key: colKey, asc: false } : null;
      }
      return { key: colKey, asc: true };
    });
  };

  // Row Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const nextSet = new Set(selectedRows);
      paginatedData.forEach((_, idx) => nextSet.add(idx + (currentPage - 1) * pageSize));
      setSelectedRows(nextSet);
    } else {
      const nextSet = new Set(selectedRows);
      paginatedData.forEach((_, idx) => nextSet.delete(idx + (currentPage - 1) * pageSize));
      setSelectedRows(nextSet);
    }
  };

  const handleSelectRow = (globalIdx) => {
    const nextSet = new Set(selectedRows);
    if (nextSet.has(globalIdx)) nextSet.delete(globalIdx);
    else nextSet.add(globalIdx);
    setSelectedRows(nextSet);
  };

  return (
    <div className="min-h-screen w-full p-2 sm:p-4 md:p-8 flex justify-center items-start font-body">
      <div className="dashboard-container w-full max-w-7xl rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6">

        {/* TOP BRAND NAVIGATION BAR */}
        <Header
          fileInfo={fileInfo}
          dataLength={data.length}
          handleFileUpload={handleFileUpload}
          resetAll={resetAll}
        />

        {/* ERROR DISPLAY BANNER */}
        {error && (
          <div className="p-3.5 sm:p-4 bg-zinc-100 border border-zinc-300 text-zinc-900 rounded-xl flex items-center gap-3 text-xs font-body">
            <AlertCircle className="w-4 h-4 shrink-0 text-black" />
            <span>{error}</span>
          </div>
        )}

        {/* NAVIGATION TAB CONTROLS */}
        <nav className="flex items-center border-b border-zinc-200 gap-1 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => setActiveTab('data-viewer')}
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'data-viewer'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Data Explorer {data.length > 0 ? `(${data.length})` : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('graph-schema')}
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'graph-schema'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
            }`}
          >
            <GitFork className="w-4 h-4 text-black" />
            <span>Graph Schema ({nodesMapping.length} Nodes, {relationshipsMapping.length} Rel)</span>
          </button>

          <button
            onClick={() => setActiveTab('neo4j-sync')}
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'neo4j-sync'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
            }`}
          >
            <Plug className="w-4 h-4 text-black" />
            <span>Neo4j Database Sync</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('logs');
              fetchDiagnosticsAndLogs();
            }}
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
            }`}
          >
            <Database className="w-4 h-4 text-black" />
            <span>Logs & DB Metrics</span>
          </button>
        </nav>

        {/* ----------------- TAB 1: DYNAMIC DATA EXPLORER ----------------- */}
        {activeTab === 'data-viewer' && (
          data.length === 0 ? (
            <Dropzone
              isDragActive={isDragActive}
              handleDrag={handleDrag}
              handleDrop={handleDrop}
              handleFileUpload={handleFileUpload}
              mainFileInputRef={mainFileInputRef}
            />
          ) : (
            <DataExplorer
              data={data}
              headers={headers}
              statusTabsList={statusTabsList}
              selectedStatusTab={selectedStatusTab}
              setSelectedStatusTab={setSelectedStatusTab}
              search={search}
              setSearch={setSearch}
              pageSize={pageSize}
              setPageSize={setPageSize}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              sortedData={sortedData}
              paginatedData={paginatedData}
              totalPages={totalPages}
              sort={sort}
              handleSort={handleSort}
              selectedRows={selectedRows}
              handleSelectAll={handleSelectAll}
              handleSelectRow={handleSelectRow}
            />
          )
        )}

        {/* ----------------- TAB 2: GRAPH SCHEMA BUILDER ----------------- */}
        {activeTab === 'graph-schema' && (
          <GraphSchemaBuilder
            headers={headers}
            isGeneratingSchema={isGeneratingSchema}
            generateGraphSchema={generateGraphSchema}
            schemaMessage={schemaMessage}
            nodesMapping={nodesMapping}
            setNodesMapping={setNodesMapping}
            addNodeMapping={addNodeMapping}
            deleteNodeMapping={deleteNodeMapping}
            toggleNodeProperty={toggleNodeProperty}
            relationshipsMapping={relationshipsMapping}
            setRelationshipsMapping={setRelationshipsMapping}
            addRelationshipMapping={addRelationshipMapping}
            deleteRelationshipMapping={deleteRelationshipMapping}
            toggleRelationshipProperty={toggleRelationshipProperty}
          />
        )}

        {/* ----------------- TAB 3: NEO4J DATABASE EXPORT ----------------- */}
        {activeTab === 'neo4j-sync' && (
          <Neo4jSync
            neo4jStatus={neo4jStatus}
            neo4jStatusMessage={neo4jStatusMessage}
            clearNeo4jNodes={clearNeo4jNodes}
            neo4jLabel={neo4jLabel}
            saveToNeo4j={saveToNeo4j}
            dataLength={data.length}
          />
        )}

        {/* ----------------- TAB 4: LOGS & DIAGNOSTICS ----------------- */}
        {activeTab === 'logs' && (
          <LogsDiagnostics
            dbDiagnostics={dbDiagnostics}
            fetchDiagnosticsAndLogs={fetchDiagnosticsAndLogs}
            logs={logs}
          />
        )}

        {/* FOOTER BAR */}
        <Footer />
      </div>
    </div>
  );
}
