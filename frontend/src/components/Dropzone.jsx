import React from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';

export default function Dropzone({ isDragActive, handleDrag, handleDrop, handleFileUpload, mainFileInputRef }) {
  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => mainFileInputRef.current?.click()}
      className={`w-full py-12 sm:py-16 px-4 sm:px-8 rounded-2xl border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-black bg-zinc-100'
          : 'border-zinc-300 hover:border-zinc-400 bg-white'
      }`}
    >
      <input
        ref={mainFileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="p-3 bg-zinc-100 text-zinc-900 rounded-xl mb-3 border border-zinc-200">
        <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>

      <h3 className="font-heading font-bold text-sm sm:text-base text-zinc-900 text-center mb-1">
        Upload your CSV file to get started
      </h3>

      <p className="font-body text-xs text-zinc-500 text-center max-w-sm mb-5 leading-relaxed">
        Drag and drop any custom CSV file here, or click to browse. The engine will analyze headers and data structures.
      </p>

      <span className="font-heading font-semibold inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-xs">
        <FileSpreadsheet className="w-4 h-4 text-white" />
        <span>Browse CSV File</span>
      </span>
    </div>
  );
}
