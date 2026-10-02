import React from 'react';

export default function AnalysisCard({
  hasSamples,
  sampleCount,
  onProcessSamples,
  isProcessing,
  processedSamples = [],
  processingError = null,
  onClearError,
}) {
  const isProcessed = processedSamples.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-5">
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            2. Analyze & Preprocess Handwriting
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Send samples to OpenCV/Pillow computer-vision pipeline to clean shadows, normalize illumination, and isolate stroke trajectories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Status:</span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              isProcessing
                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                : isProcessed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : hasSamples
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {isProcessing
              ? 'Processing samples...'
              : isProcessed
              ? '✓ Processed'
              : hasSamples
              ? 'Ready for preprocessing'
              : 'Awaiting samples'}
          </span>
        </div>
      </div>

      {/* Action / Trigger Row */}
      <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-600">
          {!hasSamples ? (
            <div className="flex items-center gap-2 text-slate-500">
              <span className="text-base">ℹ️</span>
              <span>Upload handwriting samples in Step 1 to begin preprocessing.</span>
            </div>
          ) : isProcessing ? (
            <div className="flex items-center gap-2 text-violet-700 font-medium animate-pulse">
              <span className="w-3.5 h-3.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              <span>Processing handwriting samples with OpenCV pipeline...</span>
            </div>
          ) : isProcessed ? (
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <span className="text-base">✓</span>
              <span>
                {processedSamples.length} handwriting {processedSamples.length === 1 ? 'sample' : 'samples'} processed successfully.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-700">
              <span className="text-base">⚙️</span>
              <span>
                {sampleCount} {sampleCount === 1 ? 'sample' : 'samples'} selected. Click to send to the preprocessing pipeline.
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onProcessSamples}
          disabled={!hasSamples || isProcessing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all active:scale-[0.99] shrink-0"
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin h-3.5 w-3.5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Processing handwriting samples...</span>
            </>
          ) : (
            <>
              <span>{isProcessed ? 'Re-run Preprocessing' : 'Analyze & Preprocess'}</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>

      {/* Error Message Display */}
      {processingError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-none text-rose-600">⚠️</span>
            <div>
              <span className="font-semibold block mb-0.5 text-rose-900">
                Preprocessing Error
              </span>
              <p className="text-rose-700 leading-relaxed">{processingError}</p>
            </div>
          </div>
          {onClearError && (
            <button
              type="button"
              onClick={onClearError}
              className="text-rose-400 hover:text-rose-600 text-sm font-bold px-1"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Preprocessing Success Badge & Summary */}
      {isProcessed && (
        <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
              ✓
            </span>
            <div>
              <span className="font-bold block text-emerald-900">
                Samples processed successfully
              </span>
              <span className="text-emerald-700">
                {processedSamples.length} handwriting {processedSamples.length === 1 ? 'sample' : 'samples'} processed via OpenCV & Pillow.
              </span>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 bg-white px-2.5 py-1 rounded-md border border-emerald-200 font-mono">
            Pipeline: Grayscale • Bilateral Filter • CLAHE • Adaptive Thresholding
          </span>
        </div>
      )}

      {/* Side-by-side Visual Comparison: ORIGINAL -> PREPROCESSED */}
      {isProcessed && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Visual Inspection: Original vs Preprocessed Comparison
            </h3>
            <span className="text-[11px] text-slate-400">
              Verifying stroke thickness, letter shape, and natural slant preservation
            </span>
          </div>

          <div className="space-y-4">
            {processedSamples.map((sample, idx) => (
              <div
                key={sample.filename || idx}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col gap-3"
              >
                {/* File info header */}
                <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-200/70">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center font-mono font-bold text-[10px]">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{sample.filename}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Dimensions: {sample.original_size?.width} × {sample.original_size?.height} px
                  </span>
                </div>

                {/* 2-Column Comparison: Original -> Processed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {/* Original Card */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                      <span>ORIGINAL SAMPLE</span>
                      <span className="text-slate-400 font-mono text-[10px]">Raw Camera/Scan</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs aspect-[4/3] flex items-center justify-center relative group">
                      <img
                        src={sample.originalPreviewUrl}
                        alt={`Original ${sample.filename}`}
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  </div>

                  {/* Preprocessed Card */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-violet-700 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
                        <span>PREPROCESSED PIPELINE RESULT</span>
                      </div>
                      <span className="text-violet-600/80 font-mono text-[10px]">High-Contrast Cleaned</span>
                    </div>
                    <div className="rounded-xl border-2 border-violet-200 bg-white overflow-hidden shadow-xs aspect-[4/3] flex items-center justify-center relative group">
                      <img
                        src={sample.processed_image}
                        alt={`Preprocessed ${sample.filename}`}
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
