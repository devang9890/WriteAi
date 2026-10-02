import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const PIPELINE_STEPS = [
  { id: 'samples', label: 'Handwriting samples uploaded', status: 'completed' },
  { id: 'prep', label: 'Image preprocessing', status: 'completed' },
  { id: 'ocr', label: 'OCR / handwriting recognition', status: 'pending' },
  { id: 'style', label: 'Handwriting style embedding', status: 'pending' },
  { id: 'gen', label: 'Handwriting generation', status: 'pending' },
  { id: 'pages', label: 'Page generation', status: 'pending' },
  { id: 'export', label: 'PNG/PDF export', status: 'pending' },
];

export default function GenerationModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-lg w-full p-6 sm:p-7 relative overflow-hidden text-slate-800 transition-all duration-200 animate-in fade-in zoom-in-95">
        {/* Subtle decorative gradient at top */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        >
          <span className="text-xl leading-none font-bold">&times;</span>
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 pr-6">
          <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl font-bold shrink-0 shadow-xs border border-violet-200/60">
            <span>✨</span>
          </div>
          <div>
            <h3
              id="generation-modal-title"
              className="text-xl font-bold text-slate-900 tracking-tight leading-snug"
            >
              Handwriting Generation Not Available Yet
            </h3>
            <p className="text-xs text-violet-600 font-semibold uppercase tracking-wider mt-0.5">
              Development Preview
            </p>
          </div>
        </div>

        {/* Modal Body Message */}
        <p className="text-sm text-slate-600 mt-4 leading-relaxed">
          The handwriting generation model has not been connected yet. Your samples and text are ready for the upcoming AI generation pipeline.
        </p>

        {/* Pipeline Section */}
        <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200/80 p-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Current Pipeline Status</span>
            <span className="text-[11px] font-medium text-slate-400">Step 4 of 5</span>
          </div>

          <ul className="space-y-2.5">
            {PIPELINE_STEPS.map((step) => {
              const isCompleted = step.status === 'completed';
              return (
                <li
                  key={step.id}
                  className={`flex items-center justify-between text-xs sm:text-sm px-3 py-2 rounded-lg border transition-colors ${
                    isCompleted
                      ? 'bg-emerald-50/70 border-emerald-200/70 text-emerald-950 font-medium'
                      : 'bg-white border-slate-200/60 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700 font-bold'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}
                    >
                      {isCompleted ? '✓' : '⏳'}
                    </span>
                    <span className={isCompleted ? 'text-slate-800' : 'text-slate-600'}>
                      {step.label}
                    </span>
                  </div>

                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100/70 text-amber-700'
                    }`}
                  >
                    {isCompleted ? 'Ready' : 'Upcoming'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Modal Action Footer */}
        <div className="mt-6 flex sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
