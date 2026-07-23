import React from 'react';
import { Plug, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export default function Neo4jSync({
  neo4jStatus,
  neo4jStatusMessage,
  clearNeo4jNodes,
  neo4jLabel,
  saveToNeo4j,
  dataLength
}) {
  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <div className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col gap-6">
        <div className="border-b border-zinc-200 pb-4">
          <h2 className="font-heading font-bold text-base text-zinc-900 tracking-tight flex items-center gap-2">
            <Plug className="w-5 h-5 text-black" />
            <span>Neo4j Database Sync & Controls</span>
          </h2>
          <p className="font-body text-xs text-zinc-500 mt-0.5">Export extracted graph nodes & relationships or manage existing database nodes</p>
        </div>

        {/* Status Indicator */}
        {neo4jStatusMessage && (
          <div className={`p-3.5 rounded-xl border text-xs font-body font-medium flex items-center gap-3 ${
            neo4jStatus === 'error'
              ? 'bg-zinc-100 border-zinc-300 text-zinc-900'
              : neo4jStatus === 'success'
                ? 'bg-zinc-100 border-zinc-300 text-zinc-900'
                : 'bg-zinc-100 border-zinc-300 text-zinc-900'
          }`}>
            {neo4jStatus === 'loading' && <RefreshCw className="w-4 h-4 animate-spin text-black shrink-0" />}
            {neo4jStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-black shrink-0" />}
            {neo4jStatus === 'error' && <XCircle className="w-4 h-4 text-black shrink-0" />}
            <span>{neo4jStatusMessage}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => clearNeo4jNodes(neo4jLabel)}
              disabled={neo4jStatus === 'loading'}
              className="font-heading font-semibold px-3.5 py-2 bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-800 border border-zinc-300 rounded-xl text-xs transition-colors text-center"
            >
              Clear Label Nodes
            </button>
            <button
              onClick={() => clearNeo4jNodes('*')}
              disabled={neo4jStatus === 'loading'}
              className="font-heading font-semibold px-3.5 py-2 bg-black hover:bg-zinc-800 disabled:opacity-50 text-white rounded-xl text-xs transition-colors text-center"
            >
              Wipe Entire DB
            </button>
          </div>

          <button
            onClick={saveToNeo4j}
            disabled={neo4jStatus === 'loading' || dataLength === 0}
            className="font-heading font-semibold px-5 py-2.5 bg-black hover:bg-zinc-800 disabled:opacity-50 text-white rounded-xl text-xs transition-all flex items-center justify-center gap-2"
          >
            <Plug className="w-4 h-4" />
            <span>{neo4jStatus === 'loading' ? 'Syncing to Neo4j...' : 'Export Graph to Neo4j'}</span>
          </button>
        </div>

        {/* Neo4j Property Keys Token Note */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 leading-relaxed font-body">
          <span className="font-heading font-bold text-zinc-900 block mb-1">Understanding Database Wipe & Property Keys in Neo4j:</span>
          Wiping the database deletes 100% of all data nodes and relationship edges (<code className="font-mono text-zinc-800">MATCH (n) RETURN n</code> returns 0 results).
          Neo4j maintains an internal string dictionary (token catalog) for all property key names ever registered in database history. In the Neo4j Browser UI, property keys shown in the sidebar reflect cached string tokens. To refresh the sidebar in Neo4j Browser, click the <strong>Refresh Database Information</strong> icon or reload the page (<kbd className="font-mono bg-zinc-200 px-1 rounded">F5</kbd>).
        </div>
      </div>
    </div>
  );
}
