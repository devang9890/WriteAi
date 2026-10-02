import React, { useState } from 'react';

export default function GenerationCard({ hasSamples, hasContent, onGenerated }) {
  const [showNotice, setShowNotice] = useState(false);

  const handleGenerate = () => {
    setShowNotice(true);
    if (onGenerated) onGenerated();
  };

  const isReady = hasSamples && hasContent;

  return (
    <div className="bg-gradient-to-br from-violet-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="max-w-xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-violet-300 font-semibold text-xs tracking-wider uppercase">
              Step 4
            </span>
            <span className="w-1 h-1 rounded-full bg-violet-400" />
            <span className="text-xs text-slate-300 font-medium">Generation Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            4. Generate Handwritten Notes
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Your typed content will eventually be rendered using your personalized handwriting style.
          </p>

          {!isReady && (
            <div className="text-xs text-amber-300/90 pt-1 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>
                {!hasSamples && !hasContent
                  ? 'Upload samples in Step 1 and enter text in Step 3 to proceed.'
                  : !hasSamples
                  ? 'Upload handwriting samples in Step 1 first.'
                  : 'Enter text in Step 3 first.'}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!isReady}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl font-bold text-sm text-slate-900 bg-white hover:bg-slate-100 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.99] shrink-0"
        >
          <span>✨ Generate Handwritten Notes</span>
        </button>
      </div>

      {showNotice && (
        <div className="relative z-10 mt-6 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-xs text-slate-200 flex items-start gap-3 animate-fadeIn">
          <span className="text-lg leading-none">🚀</span>
          <div>
            <span className="font-semibold text-white block mb-0.5">
              Step 1 Prototype Notice:
            </span>
            <p className="text-slate-200 leading-relaxed">
              Handwriting generation will be connected in the AI generation step. No fake handwriting or synthetic fonts are generated.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
