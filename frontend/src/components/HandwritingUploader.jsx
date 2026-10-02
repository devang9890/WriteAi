import React, { useRef, useState } from 'react';

export default function HandwritingUploader({ samples, onAddSamples, onRemoveSample, onClearAll }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddSamples(Array.from(e.target.files));
      e.target.value = ''; // Reset input to allow re-selection
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file) =>
        ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)
      );
      if (validFiles.length > 0) {
        onAddSamples(validFiles);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-5">
      {/* Title & Description */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              1. Upload Your Handwriting
            </h2>
            {samples.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {samples.length} {samples.length === 1 ? 'sample' : 'samples'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Upload multiple clear pages of your handwriting. These samples will be used to learn your writing style.
          </p>
        </div>

        {samples.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png, image/jpeg, image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-violet-500 bg-violet-50/50 scale-[0.99]'
            : 'border-slate-300 hover:border-violet-400 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-violet-600 mb-3">
          <svg
            className="w-6 h-6 stroke-current fill-none stroke-2"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p className="text-sm font-semibold text-slate-800">
          Drop handwriting samples here
        </p>
        <p className="text-xs text-slate-500 mt-0.5">or click to browse</p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
            Supported: PNG, JPG, JPEG
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="text-violet-600 font-medium">
            Recommended: 5–20 handwritten pages for better personalization
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="mt-5 px-4 py-2 rounded-xl text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-colors shadow-xs"
        >
          Upload Samples
        </button>
      </div>

      {/* Thumbnails Grid */}
      {samples.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Uploaded Samples ({samples.length})</span>
            <span className="text-slate-400">Stored in local session memory</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {samples.map((sample, idx) => (
              <div
                key={sample.id || idx}
                className="group relative rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs flex flex-col"
              >
                <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={sample.previewUrl}
                    alt={sample.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSample(idx);
                    }}
                    title="Remove sample"
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/70 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors shadow-sm"
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    #{idx + 1}
                  </span>
                </div>
                <div className="p-2 border-t border-slate-100 bg-white">
                  <p className="text-[11px] font-medium text-slate-700 truncate" title={sample.name}>
                    {sample.name}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {(sample.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
