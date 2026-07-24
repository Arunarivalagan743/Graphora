import React from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, FileText, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

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
  handleSelectRow,
  manualRowDraft,
  handleManualRowChange,
  addManualRow
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

      {/* Manual Row Entry */}
      {headers.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-heading font-bold text-sm text-zinc-900">Manual Row Entry</h3>
              <p className="font-body text-[11px] text-zinc-500 mt-0.5">Fill values using the current CSV headers, then add the row to the table.</p>
            </div>

            <button
              type="button"
              onClick={addManualRow}
              className="font-heading font-semibold px-3.5 py-2 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {headers.map(col => (
              <label key={col} className="flex flex-col gap-1.5">
                <span className="font-heading font-semibold text-[10px] uppercase tracking-wider text-zinc-500">{col}</span>
                <input
                  type="text"
                  value={manualRowDraft?.[col] ?? ''}
                  onChange={(e) => handleManualRowChange(col, e.target.value)}
                  className="neat-input px-3 py-2 rounded-xl text-xs font-body"
                  placeholder={`Enter ${col}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* TABLE CONTAINER */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col w-full">
        <div className="overflow-x-auto min-h-[340px] w-full">
          {sortedData.length > 0 ? (
            <table className="w-full border-collapse text-left min-w-max">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-800 font-heading font-bold text-xs select-none">
                  <th className="w-12 px-4 py-3 text-center sticky left-0 z-20 bg-zinc-50 border-r border-zinc-200">
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
                      className="px-4 py-3 cursor-pointer hover:text-black whitespace-nowrap text-xs select-none font-heading font-semibold min-w-[130px]"
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
                    <tr key={globalIdx} className={`hover:bg-zinc-50 transition-colors ${isChecked ? 'bg-zinc-100' : ''}`}>
                      <td className="px-4 py-3 text-center sticky left-0 z-10 bg-white border-r border-zinc-100">
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
                            className={`px-4 py-2.5 align-middle whitespace-nowrap max-w-xs truncate ${isNum ? 'text-right font-mono font-medium text-zinc-900' : 'text-zinc-700'}`}
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
