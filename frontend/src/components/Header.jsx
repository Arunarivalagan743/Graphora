import React from 'react';
import { Network, FileSpreadsheet, Upload, RotateCcw } from 'lucide-react';

export default function Header({ fileInfo, dataLength, handleFileUpload, resetAll }) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4 sm:pb-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
          <Network className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading font-extrabold text-lg sm:text-xl md:text-2xl tracking-tight text-black">
              Graphora
            </h1>
            <span className="font-heading font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 border border-zinc-300">
              Graph Intelligence
            </span>
          </div>
          <p className="font-body text-xs text-zinc-500 mt-0.5">
            Upload CSV files to dynamically map nodes, properties & relationships into Neo4j
          </p>
        </div>
      </div>

      {/* Action Header Controls */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
        {fileInfo && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs text-zinc-700">
            <FileSpreadsheet className="w-4 h-4 text-black shrink-0" />
            <span className="font-heading font-semibold text-zinc-900 truncate max-w-[130px] sm:max-w-[160px]">{fileInfo.name}</span>
            <span className="font-mono text-zinc-500 text-[11px]">({fileInfo.rowCount} rows)</span>
          </div>
        )}

        <label className="font-heading font-semibold px-3.5 py-2 bg-black hover:bg-zinc-800 text-white text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0">
          <Upload className="w-4 h-4" />
          <span>{dataLength > 0 ? 'Upload New CSV' : 'Upload CSV File'}</span>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </label>

        {fileInfo && (
          <button
            onClick={resetAll}
            className="font-heading font-medium px-3 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-xl text-xs text-zinc-800 transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-600" />
            <span>Clear Data</span>
          </button>
        )}
      </div>
    </header>
  );
}
