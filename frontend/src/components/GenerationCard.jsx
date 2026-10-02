import React, { useState } from 'react';
import GenerationModal from './GenerationModal';
import ToastNotification from './ToastNotification';

export default function GenerationCard({ hasSamples, hasContent }) {
  // Conceptual state structure: 'idle' | 'validation-error' | 'not-implemented'
  const [generationStatus, setGenerationStatus] = useState('idle');
  const [validationMessage, setValidationMessage] = useState('');

  const handleGenerateClick = () => {
    // Step 1: Check handwriting samples
    if (!hasSamples) {
      setGenerationStatus('validation-error');
      setValidationMessage('Please upload your handwriting samples first.');
      return;
    }

    // Step 2: Check entered text
    if (!hasContent) {
      setGenerationStatus('validation-error');
      setValidationMessage('Please enter some content before generating.');
      return;
    }

    // Step 3: Both exist -> Open development pipeline modal
    setGenerationStatus('not-implemented');
    setValidationMessage('');
  };

  const handleCloseToast = () => {
    if (generationStatus === 'validation-error') {
      setGenerationStatus('idle');
      setValidationMessage('');
    }
  };

  const handleCloseModal = () => {
    setGenerationStatus('idle');
  };

  return (
    <>
      <div className="bg-gradient-to-br from-violet-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-violet-300 font-semibold text-xs tracking-wider uppercase">
                Step 5
              </span>
              <span className="w-1 h-1 rounded-full bg-violet-400" />
              <span className="text-xs text-slate-300 font-medium">Generation Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              5. Generate Handwritten Notes
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Your typed content will be rendered using your personalized handwriting style once connected to the AI generation pipeline.
            </p>

            {/* Application status guidance */}
            <div className="text-xs text-slate-300/80 pt-1 flex items-center gap-1.5">
              <span>💡</span>
              <span>
                {!hasSamples && !hasContent
                  ? 'Prerequisites: Upload handwriting samples (Step 1) and enter notes text (Step 4).'
                  : !hasSamples
                  ? 'Prerequisite: Upload handwriting samples in Step 1.'
                  : !hasContent
                  ? 'Prerequisite: Enter your notes text in Step 4.'
                  : 'Ready: Samples and notes are prepared for generation.'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateClick}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl font-bold text-sm text-slate-900 bg-white hover:bg-slate-100 shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer shrink-0"
          >
            <span>✨ Generate Handwritten Notes</span>
          </button>
        </div>

        {/* Inline validation notification if error occurred */}
        {generationStatus === 'validation-error' && validationMessage && (
          <div className="relative z-10 mt-5 rounded-xl bg-amber-500/20 border border-amber-400/40 p-3.5 text-xs text-amber-200 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">⚠️</span>
              <span className="font-medium text-amber-100">{validationMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleCloseToast}
              aria-label="Dismiss error"
              className="text-amber-300 hover:text-white p-1 rounded transition-colors text-base font-bold leading-none"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Floating Toast Notification for validation */}
      <ToastNotification
        isOpen={generationStatus === 'validation-error'}
        title="Action Required"
        message={validationMessage}
        onClose={handleCloseToast}
      />

      {/* Development State Modal for generation */}
      <GenerationModal
        isOpen={generationStatus === 'not-implemented'}
        onClose={handleCloseModal}
      />
    </>
  );
}
