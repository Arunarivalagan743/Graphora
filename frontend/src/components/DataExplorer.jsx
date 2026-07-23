import React from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataExplorer({
  data,
  headers,
  statusTabsList,
  selectedStatusTab,
  setSelectedStatusTab,
  search,
  setSearch,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  sortedData,
  paginatedData,
  totalPages,
  sort,
  handleSort,
  selectedRows,
  handleSelectAll,
  handleSelectRow
}) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5 animate-slide-up">
      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {statusTabsList.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setSelectedStatusTab('All'); setCurrentPage(1); }}
              className={`font-heading text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedStatusTab === 'All'
                  ? 'bg-black text-white font-semibold'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 font-medium'
              }`}
            >
              <span>All ({data.length})</span>
            </button>

            {statusTabsList.map(tab => (
              <button
                key={tab.name}
                onClick={() => { setSelectedStatusTab(tab.name); setCurrentPage(1); }}
                className={`font-heading text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  selectedStatusTab === tab.name
                    ? 'bg-black text-white font-semibold'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 font-medium'
                }`}
              >
                <span>{tab.name}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 text-zinc-900 font-bold">{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search & Page Size */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto ml-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search uploaded records..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl text-xs neat-input font-body"
            />
          </div>

          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="neat-input px-3 py-1.5 rounded-xl text-xs font-heading font-medium text-zinc-800 outline-none shrink-0"
          >
            <option value={10}>10 / page</option>
            <option value={15}>15 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col max-w-full">
        <div className="overflow-x-auto min-h-[340px]">
          {sortedData.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-800 font-heading font-bold text-xs select-none">
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedData.length > 0 && paginatedData.every((_, idx) => selectedRows.has(idx + (currentPage - 1) * pageSize))}
                      onChange={handleSelectAll}
                      className="rounded border-zinc-300 text-black focus:ring-black cursor-pointer"
                    />
                  </th>

                  {headers.map(col => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 cursor-pointer hover:text-black whitespace-nowrap text-xs select-none font-heading font-semibold"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col}</span>
                        {sort && sort.key === col ? (
                          sort.asc ? <ArrowUp className="w-3 h-3 text-black" /> : <ArrowDown className="w-3 h-3 text-black" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100 text-xs font-body">
                {paginatedData.map((row, rowIdx) => {
                  const globalIdx = rowIdx + (currentPage - 1) * pageSize;
                  const isChecked = selectedRows.has(globalIdx);

                  return (
                    <tr key={rowIdx} className={`hover:bg-zinc-50 transition-colors ${isChecked ? 'bg-zinc-100' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectRow(globalIdx)}
                          className="rounded border-zinc-300 text-black focus:ring-black cursor-pointer"
                        />
                      </td>

                      {headers.map(col => {
                        const val = row[col];
                        const valStr = val === null || val === undefined ? '' : String(val);
                        const isNum = typeof val === 'number';

                        return (
                          <td
                            key={col}
                            className={`px-4 py-2.5 truncate max-w-[240px] ${isNum ? 'text-right font-mono font-medium text-zinc-900' : 'text-zinc-700'}`}
                          >
                            {valStr}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 text-xs font-body">
              <FileText className="w-8 h-8 stroke-1 mb-2 text-zinc-300" />
              <span>No records match your active search query.</span>
            </div>
          )}
        </div>

        {/* PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200 p-3.5 bg-zinc-50">
            <span className="font-body text-xs text-zinc-600">
              Showing <span className="font-mono font-semibold text-zinc-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-mono font-semibold text-zinc-900">{Math.min(currentPage * pageSize, sortedData.length)}</span> of{' '}
              <span className="font-mono font-semibold text-zinc-900">{sortedData.length}</span> entries
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-zinc-300 hover:bg-zinc-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-zinc-700" />
              </button>

              <span className="font-heading px-2.5 py-1 bg-white border border-zinc-300 rounded-md text-xs font-semibold text-zinc-800">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-zinc-300 hover:bg-zinc-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-zinc-700" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
