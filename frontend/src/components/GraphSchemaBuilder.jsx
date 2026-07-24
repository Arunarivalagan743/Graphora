import React from 'react';
import { Layers, RefreshCw, CheckCircle2, Plus, Trash2, Link } from 'lucide-react';

export default function GraphSchemaBuilder({
  headers,
  isGeneratingSchema,
  generateGraphSchema,
  schemaMessage,
  nodesMapping,
  setNodesMapping,
  addNodeMapping,
  deleteNodeMapping,
  toggleNodeProperty,
  relationshipsMapping,
  setRelationshipsMapping,
  addRelationshipMapping,
  deleteRelationshipMapping,
  toggleRelationshipProperty
}) {
  return (
    <div className="flex flex-col gap-5 sm:gap-6 animate-slide-up">
      {/* Header banner */}
      <div className="bg-black text-white rounded-xl sm:rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 border border-zinc-800">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-white flex items-center gap-2">
              Graph Schema Intelligence
            </h2>
            <p className="font-body text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
              Analyzes the current CSV column headers and data to structure entity nodes, primary key identifiers, properties, and relationship links when you choose to run it.
            </p>
          </div>
        </div>

        <button
          onClick={() => generateGraphSchema()}
          disabled={isGeneratingSchema || headers.length === 0}
          className="font-heading font-semibold px-4 py-2.5 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 text-xs rounded-xl transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingSchema ? 'animate-spin' : ''}`} />
          <span>{isGeneratingSchema ? 'Analyzing CSV...' : 'Generate Graph Schema'}</span>
        </button>
      </div>

      {/* AI Status Banner */}
      {schemaMessage && (
        <div className="p-3.5 bg-zinc-100 border border-zinc-300 text-zinc-900 rounded-xl text-xs font-body font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
          <span>{schemaMessage}</span>
        </div>
      )}

      {/* DYNAMIC NODES MAPPING SECTION */}
      <div className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 pb-3 gap-2">
          <div>
            <h3 className="font-heading font-bold text-sm text-zinc-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-black" />
              <span>Configured Graph Nodes ({nodesMapping.length})</span>
            </h3>
            <p className="font-body text-[11px] text-zinc-500 mt-0.5">Specify label names, primary key columns, and properties for each entity node</p>
          </div>

          <button
            onClick={addNodeMapping}
            disabled={headers.length === 0}
            className="font-heading font-semibold px-3 py-1.5 bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Node</span>
          </button>
        </div>

        {nodesMapping.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs font-body border border-dashed border-zinc-300 rounded-xl">
            No nodes configured. Upload a CSV file to generate dynamic graph nodes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nodesMapping.map((node, nIdx) => (
              <div key={node.id} className="border border-zinc-200 rounded-xl p-3.5 sm:p-4 bg-zinc-50 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-mono font-bold w-5 h-5 rounded-full bg-black text-white text-[10px] flex items-center justify-center shrink-0">
                      :{nIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={node.label}
                      onChange={(e) => {
                        const newLabel = e.target.value;
                        setNodesMapping(prev => prev.map(n => n.id === node.id ? { ...n, label: newLabel } : n));
                      }}
                      className="neat-input px-3 py-1 rounded-lg text-xs font-heading font-bold text-zinc-900 w-full"
                      placeholder="Node Label"
                    />
                  </div>

                  <button
                    onClick={() => deleteNodeMapping(node.id)}
                    className="p-1 text-zinc-500 hover:text-black hover:bg-zinc-200 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Primary Key Identifier Selection */}
                <div className="flex flex-col gap-1">
                  <label className="font-heading font-semibold text-[10px] uppercase tracking-wider text-zinc-500">Primary Key Column (ID):</label>
                  <select
                    value={node.idColumn}
                    onChange={(e) => {
                      const newCol = e.target.value;
                      setNodesMapping(prev => prev.map(n => n.id === node.id ? { ...n, idColumn: newCol } : n));
                    }}
                    className="neat-input px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-zinc-900 outline-none"
                  >
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Properties Selection Checkboxes */}
                <div className="flex flex-col gap-1">
                  <label className="font-heading font-semibold text-[10px] uppercase tracking-wider text-zinc-500">Included Properties:</label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-zinc-200">
                    {headers.map(h => {
                      const isChecked = node.properties.includes(h);
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggleNodeProperty(node.id, h)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all flex items-center gap-1 ${isChecked
                              ? 'bg-black text-white font-bold'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                          {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                          <span>{h}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DYNAMIC RELATIONSHIPS MAPPING SECTION */}
      <div className="bg-white border border-zinc-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 pb-3 gap-2">
          <div>
            <h3 className="font-heading font-bold text-sm text-zinc-900 flex items-center gap-2">
              <Link className="w-4 h-4 text-black" />
              <span>Configured Node Relationships ({relationshipsMapping.length})</span>
            </h3>
            <p className="font-body text-[11px] text-zinc-500 mt-0.5">Define directional graph edges connecting source nodes to target nodes</p>
          </div>

          <button
            onClick={addRelationshipMapping}
            disabled={nodesMapping.length < 2}
            className="font-heading font-semibold px-3 py-1.5 bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Relationship</span>
          </button>
        </div>

        {relationshipsMapping.length === 0 ? (
          <div className="p-6 text-center text-zinc-400 text-xs font-body border border-dashed border-zinc-300 rounded-xl">
            No relationships configured yet. Upload a CSV file or click Auto-Structure Graph Schema.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {relationshipsMapping.map((rel) => (
              <div key={rel.id} className="border border-zinc-200 rounded-xl p-3.5 sm:p-4 bg-zinc-50 flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 justify-between">
                  {/* Source Node Select */}
                  <div className="flex flex-col gap-1 w-full lg:w-1/3">
                    <label className="font-heading font-semibold text-[10px] uppercase tracking-wider text-zinc-500">Source Node:</label>
                    <select
                      value={rel.sourceNodeId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRelationshipsMapping(prev => prev.map(r => r.id === rel.id ? { ...r, sourceNodeId: val } : r));
                      }}
                      className="neat-input px-2.5 py-1.5 rounded-lg text-xs font-heading font-semibold text-zinc-800"
                    >
                      {nodesMapping.map(n => (
                        <option key={n.id} value={n.id}>(:{n.label}) [{n.idColumn}]</option>
                      ))}
                    </select>
                  </div>

                  {/* Relationship Type Text */}
                  <div className="flex flex-col gap-1 w-full lg:w-1/3 text-center">
                    <label className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-700">-[RELATIONSHIP_TYPE] &rarr;</label>
                    <input
                      type="text"
                      value={rel.type}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                        setRelationshipsMapping(prev => prev.map(r => r.id === rel.id ? { ...r, type: val } : r));
                      }}
                      className="neat-input px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-zinc-900 text-center uppercase"
                      placeholder="BELONGS_TO"
                    />
                  </div>

                  {/* Target Node Select */}
                  <div className="flex flex-col gap-1 w-full lg:w-1/3">
                    <label className="font-heading font-semibold text-[10px] uppercase tracking-wider text-zinc-500">Target Node:</label>
                    <select
                      value={rel.targetNodeId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRelationshipsMapping(prev => prev.map(r => r.id === rel.id ? { ...r, targetNodeId: val } : r));
                      }}
                      className="neat-input px-2.5 py-1.5 rounded-lg text-xs font-heading font-semibold text-zinc-800"
                    >
                      {nodesMapping.map(n => (
                        <option key={n.id} value={n.id}>(:{n.label}) [{n.idColumn}]</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => deleteRelationshipMapping(rel.id)}
                    className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-200 rounded-md transition-colors shrink-0 self-end lg:self-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Relationship Properties Checkboxes */}
                <div className="flex flex-col gap-1 pt-2 border-t border-zinc-200">
                  <label className="font-heading font-semibold text-[10px] uppercase tracking-wider text-zinc-500">Relationship Edge Properties:</label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-white rounded-lg border border-zinc-200">
                    {headers.map(h => {
                      const isChecked = (rel.properties || []).includes(h);
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggleRelationshipProperty(rel.id, h)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all flex items-center gap-1 ${isChecked
                              ? 'bg-black text-white font-bold'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                          {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                          <span>{h}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
