import React from 'react';
import { FileSpreadsheet, GitFork, Plug, Database, AlertCircle, Bot } from 'lucide-react';

import Header from './components/Header';
import Dropzone from './components/Dropzone';
import DataExplorer from './components/DataExplorer';
import GraphSchemaBuilder from './components/GraphSchemaBuilder';
import Neo4jSync from './components/Neo4jSync';
import LogsDiagnostics from './components/LogsDiagnostics';
import ChatWindow from './components/chat/ChatWindow';
import Footer from './components/Footer';
import useAppData from './hooks/useAppData';

export default function App() {
  const {
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
    sortedData,
    paginatedData,
    totalPages,
    handleSort,
    handleSelectAll,
    handleSelectRow,
    fetchDiagnosticsAndLogs,
  } = useAppData();

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
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'data-viewer'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
              }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Data Explorer {data.length > 0 ? `(${data.length})` : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('graph-schema')}
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'graph-schema'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
              }`}
          >
            <GitFork className="w-4 h-4 text-black" />
            <span>Graph Schema ({nodesMapping.length} Nodes, {relationshipsMapping.length} Rel)</span>
          </button>

          <button
            onClick={() => setActiveTab('neo4j-sync')}
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'neo4j-sync'
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
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'logs'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
              }`}
          >
            <Database className="w-4 h-4 text-black" />
            <span>Logs & DB Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('ai-assistant')}
            className={`font-heading text-xs py-2.5 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'ai-assistant'
                ? 'border-black text-black font-bold'
                : 'border-transparent text-zinc-500 hover:text-black font-medium'
              }`}
          >
            <Bot className="w-4 h-4 text-black" />
            <span>AI Assistant</span>
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
              manualRowDraft={manualRowDraft}
              handleManualRowChange={handleManualRowChange}
              addManualRow={addManualRow}
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
            cleanAndSaveToNeo4j={cleanAndSaveToNeo4j}
            dataLength={data.length}
            neo4jStreaming={neo4jStreaming}
            neo4jProgress={neo4jProgress}
            neo4jBatches={neo4jBatches}
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

        {/* ----------------- TAB 5: AI ASSISTANT ----------------- */}
        {activeTab === 'ai-assistant' && (
          <ChatWindow />
        )}

        {/* FOOTER BAR */}
        <Footer />
      </div>
    </div>
  );
}
