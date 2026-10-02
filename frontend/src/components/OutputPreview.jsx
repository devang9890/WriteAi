import React from 'react';

export default function OutputPreview({ generatedPages = [] }) {
  const hasPages = generatedPages.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            5. Generated Notes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Preview high-resolution personalized handwritten pages ready for export.
          </p>
        </div>

        {/* Download Buttons (Disabled for Step 1) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPages}
            title="Download PNG (Enabled when pages are generated)"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            <span>🖼️</span>
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            disabled={!hasPages}
            title="Download PDF (Enabled when pages are generated)"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-400 disabled:cursor-not-allowed transition-colors"
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
