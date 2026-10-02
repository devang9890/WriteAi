import React from 'react';

export default function OutputPreview({ generatedPages = [] }) {
  const hasPages = Array.isArray(generatedPages) && generatedPages.length > 0;

  const handleDownload = (e, format) => {
    // Strictly guard against downloads when no generated pages exist
    if (!hasPages) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            6. Generated Notes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Preview high-resolution personalized handwritten pages ready for export.
          </p>
        </div>

        {/* Download Buttons (Disabled while no generated pages exist) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPages}
            onClick={(e) => handleDownload(e, 'png')}
            title={hasPages ? 'Download generated pages as PNG' : 'Download PNG (Disabled: No pages generated yet)'}
            aria-disabled={!hasPages}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 enabled:bg-white enabled:hover:bg-slate-50 enabled:text-slate-700 enabled:border-slate-300 enabled:shadow-xs"
          >
            <span>🖼️</span>
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            disabled={!hasPages}
            onClick={(e) => handleDownload(e, 'pdf')}
            title={hasPages ? 'Download generated pages as PDF' : 'Download PDF (Disabled: No pages generated yet)'}
            aria-disabled={!hasPages}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 enabled:bg-white enabled:hover:bg-slate-50 enabled:text-slate-700 enabled:border-slate-300 enabled:shadow-xs"
          >
            <span>📄</span>
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Preview Canvas Area */}
      <div className="min-h-[380px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 flex flex-col items-center justify-center text-center">
        {!hasPages ? (
          <div className="max-w-sm flex flex-col items-center gap-3">
            {/* Handwriting / Document Icon */}
            <div className="w-16 h-16 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400 text-3xl">
              ✍️
            </div>
            <h3 className="text-base font-bold text-slate-700 mt-2">
              No handwritten pages generated yet
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your generated pages will appear here once the AI generation pipeline renders your typed content in your custom handwriting style.
            </p>
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] text-slate-500 border border-slate-200/80">
              Future Export Formats: Single-page PNG • Multi-page PDF
            </div>
          </div>
        ) : (
          <div className="w-full">
            {/* Future rendering container for generated page canvases/images */}
          </div>
        )}
      </div>
    </div>
  );
}
