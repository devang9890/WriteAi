import React, { useState } from 'react';

export default function AnalysisCard({ hasSamples, sampleCount, onAnalyzed }) {
  const [showNotice, setShowNotice] = useState(false);

  const handleAnalyze = () => {
    setShowNotice(true);
    if (onAnalyzed) onAnalyzed();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            2. Analyze Your Handwriting
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Extract stroke patterns, curvature, letter spacing, and pen variations from uploaded samples.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Status:</span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              hasSamples
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {hasSamples ? 'Ready for analysis' : 'Awaiting samples'}
          </span>
        </div>
      </div>

      <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-600">
          {!hasSamples ? (
            <div className="flex items-center gap-2 text-slate-500">
              <span className="text-base">ℹ️</span>
              <span>Upload handwriting samples to begin analysis.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-700">
              <span className="text-base">✨</span>
              <span>
                {sampleCount} {sampleCount === 1 ? 'sample' : 'samples'} ready. Click below to initialize style extraction.
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!hasSamples}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all active:scale-[0.99] shrink-0"
        >
          <span>Analyze Handwriting</span>
          <span>→</span>
        </button>
      </div>

      {showNotice && (
        <div className="rounded-xl bg-violet-50/80 border border-violet-200 p-4 text-xs text-violet-800 flex items-start gap-2.5 animate-fadeIn">
          <span className="text-base leading-none">🛠️</span>
          <div>
            <span className="font-semibold block mb-0.5">Development Notice (Step 1 Prototype):</span>
            <p className="text-violet-700 leading-relaxed">
              Handwriting analysis pipeline will be connected in the next AI/ML step. No mock or fake metrics are shown.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
