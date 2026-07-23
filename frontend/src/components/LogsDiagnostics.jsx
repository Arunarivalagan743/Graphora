import React from 'react';
import { Database, RefreshCw } from 'lucide-react';

export default function LogsDiagnostics({
  dbDiagnostics,
  fetchDiagnosticsAndLogs,
  logs
}) {
  return (
    <div className="flex flex-col gap-5 sm:gap-6 animate-slide-up">
      {/* DB Diagnostics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-500">Total Graph Nodes</div>
          <div className="font-mono text-2xl font-bold text-zinc-900 mt-1">{dbDiagnostics?.totalNodes ?? 0}</div>
          <div className="font-body text-xs text-zinc-500 mt-0.5">Active nodes in connected Neo4j instance</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-500">Node Label Types</div>
          <div className="font-mono text-2xl font-bold text-zinc-900 mt-1">
            {(dbDiagnostics?.labels || []).length}
          </div>
          <div className="font-mono text-xs text-zinc-500 mt-0.5 truncate">
            {(dbDiagnostics?.labels || []).map(l => l.labels.join(',')).join(', ') || 'None'}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-500">Relationship Types</div>
          <div className="font-mono text-2xl font-bold text-zinc-900 mt-1">
            {(dbDiagnostics?.relationships || []).length}
          </div>
          <div className="font-mono text-xs text-zinc-500 mt-0.5 truncate">
            {(dbDiagnostics?.relationships || []).map(r => r.type).join(', ') || 'None'}
          </div>
        </div>
      </div>

      {/* Execution Logs Table */}
      <div className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <h3 className="font-heading font-bold text-sm text-zinc-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-black" />
            <span>Backend Execution Logs History</span>
          </h3>

          <button
            onClick={fetchDiagnosticsAndLogs}
            className="font-heading font-semibold px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs font-body">No upload log history available yet.</div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-xs font-body">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-800 font-heading font-bold text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Label/Schema</th>
                  <th className="px-3 py-2 text-right">Records</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Target URI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2 font-mono text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 font-heading font-semibold text-zinc-900">{log.label}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-zinc-800">{log.recordCount}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'success' ? 'bg-zinc-100 text-zinc-900 border border-zinc-300' : 'bg-black text-white'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-500 text-[11px] truncate max-w-[180px]">{log.uri}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
