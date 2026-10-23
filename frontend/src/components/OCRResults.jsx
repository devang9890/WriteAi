import React, { useState, useEffect } from 'react';

/**
 * OCRResults Component
 * Displays recognized handwritten text alongside original segmented line crops
 * for visual comparison and model accuracy inspection.
 * Uses clean inline SVGs with zero external icon dependencies.
 */
export default function OCRResults({
  ocrData,
  isLoading,
  error,
  onRecognize,
  canRecognize,
  activeSampleFilename,
  lineCount = 0,
  onUseText,
}) {
  const [copied, setCopied] = useState(false);
  const [usedText, setUsedText] = useState(false);
  const [lineCopiedIdx, setLineCopiedIdx] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live timer tracking elapsed inference duration during active OCR
  useEffect(() => {
    let interval = null;
    if (isLoading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const formatElapsed = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    if (mins > 0) {
      return `${mins}m ${remainder < 10 ? '0' : ''}${remainder}s`;
    }
    return `${sec}s`;
  };

  const handleCopyFullText = () => {
    if (!ocrData?.full_text) return;
    navigator.clipboard.writeText(ocrData.full_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleUseFullText = () => {
    if (!ocrData?.full_text || !onUseText) return;
    onUseText(ocrData.full_text);
    setUsedText(true);
    setTimeout(() => setUsedText(false), 2500);
  };

  const handleCopyLine = (text, idx) => {
    navigator.clipboard.writeText(text);
    setLineCopiedIdx(idx);
    setTimeout(() => setLineCopiedIdx(null), 2000);
  };

  // Determine error category for better visual notice
  const isTimeoutError = error && (error.toLowerCase().includes('timed out') || error.toLowerCase().includes('timeout'));
  const isConnectionError = error && (error.toLowerCase().includes('unavailable') || error.toLowerCase().includes('connection'));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Handwriting Recognition (OCR)
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  Step 4 • TrOCR
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Transcribes cropped handwritten lines into digital text using pretrained Microsoft TrOCR
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRecognize}
            disabled={!canRecognize || isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm ${
              !canRecognize || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-600/25 shadow-lg active:scale-98 cursor-pointer'
            }`}
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>
                  Recognizing handwriting... {elapsedSeconds > 0 ? `(${formatElapsed(elapsedSeconds)})` : ''}
                </span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Recognize Handwriting</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Progress State with Live Elapsed Time */}
      {isLoading && (
        <div className="my-8 p-6 rounded-xl bg-violet-950/20 border border-violet-800/30 text-center">
          <div className="inline-flex p-3 rounded-full bg-violet-500/10 text-violet-400 mb-3 animate-pulse">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h4 className="text-base font-semibold text-slate-200">
            Running Handwritten Text Recognition (TrOCR)...
          </h4>
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-violet-900/40 border border-violet-700/50 text-xs font-mono text-violet-300">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
            <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
          </div>
          <p className="text-xs text-slate-400 max-w-lg mx-auto mt-2 leading-relaxed">
            Feeding each segmented line crop through the vision encoder and autoregressive text decoder.
            CPU processing runs sequentially and typically requires 2 to 4 minutes for full handwritten pages (e.g. 30+ lines).
          </p>
          <div className="w-56 h-1 bg-slate-800 rounded-full mx-auto mt-4 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-violet-500 to-indigo-500 animate-[pulse_1.5s_infinite]" />
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && !isLoading && (
        <div
          className={`my-5 p-4 rounded-xl border flex items-start gap-3 ${
            isTimeoutError
              ? 'bg-amber-950/30 border-amber-800/40'
              : 'bg-red-950/30 border-red-800/40'
          }`}
        >
          <svg
            className={`w-5 h-5 shrink-0 mt-0.5 ${isTimeoutError ? 'text-amber-400' : 'text-red-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-xs">
            <p className={`font-semibold ${isTimeoutError ? 'text-amber-300' : 'text-red-300'}`}>
              {isTimeoutError
                ? 'OCR Request Timeout'
                : isConnectionError
                ? 'Backend Connection Notice'
                : 'OCR Recognition Error'}
            </p>
            <p className={`mt-1 leading-relaxed ${isTimeoutError ? 'text-amber-400/90' : 'text-red-400/90'}`}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Empty State before running */}
      {!ocrData && !isLoading && !error && (
        <div className="py-10 text-center text-slate-500 text-xs">
          <div className="inline-flex p-3 rounded-2xl bg-slate-800/50 text-slate-400 mb-3">
            <svg className="w-6 h-6 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-medium text-slate-300 text-sm">No OCR transcription yet</p>
          <p className="mt-1 max-w-xs mx-auto text-slate-400">
            {canRecognize
              ? 'Click "Recognize Handwriting" above to transcribe the uploaded page lines.'
              : 'Upload a handwriting sample first to enable line recognition.'}
          </p>
        </div>
      )}

      {/* Populated Results View */}
      {ocrData && !isLoading && (
        <div className="mt-6 space-y-6">
          {/* Metadata Diagnostic Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Model Architecture</span>
              <span className="font-semibold text-slate-300 truncate block mt-0.5" title={ocrData.model}>
                {ocrData.model?.split('/')[1] || ocrData.model || 'trocr-base-handwritten'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Hardware Device</span>
              <span className="font-semibold text-violet-400 block mt-0.5">
                {ocrData.device || 'CPU'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Lines Transcribed</span>
              <span className="font-semibold text-emerald-400 block mt-0.5">
                {ocrData.line_count ?? ocrData.lines?.length ?? 0} lines
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Inference Time</span>
              <span className="font-semibold text-indigo-400 block mt-0.5">
                {ocrData.inference_time_sec ? `${ocrData.inference_time_sec}s` : 'Complete'}
              </span>
            </div>
          </div>

          {/* Combined Recognized Text Area */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Combined Recognized Text
              </span>
              <div className="flex items-center gap-2">
                {onUseText && (
                  <button
                    type="button"
                    onClick={handleUseFullText}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-violet-900/40 hover:bg-violet-800/60 text-violet-300 border border-violet-700/50 transition-colors cursor-pointer"
                    title="Send recognized text to Section 5 Content Editor"
                  >
                    {usedText ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-400">Added to Notes!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Send to Notes Editor</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyFullText}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="Copy all recognized text"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy Full Text</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              readOnly
              value={ocrData.full_text || ''}
              rows={Math.min(10, Math.max(4, ocrData.line_count || 4))}
              className="w-full bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none resize-y selection:bg-violet-600/30"
              placeholder="No recognized text generated."
            />
          </div>

          {/* Line-by-Line Inspection List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Line-by-Line Verification ({ocrData.lines?.length || 0} lines)
              </h4>
              <span className="text-[11px] text-slate-500">
                Comparing original handwriting crop with TrOCR prediction
              </span>
            </div>

            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {ocrData.lines?.map((line) => {
                const isLineCopied = lineCopiedIdx === line.index;
                return (
                  <div
                    key={line.index}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all duration-150"
                  >
                    {/* Line Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/20">
                          Line {line.index}
                        </span>
                        {line.bbox && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            y: {line.bbox.y}, h: {line.bbox.height}px
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyLine(line.text, line.index)}
                        className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copy this line text"
                      >
                        {isLineCopied ? (
                          <>
                            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Original Handwriting Crop Preview */}
                    {line.image && (
                      <div className="mb-2.5 p-1.5 bg-white/5 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-start">
                        <img
                          src={line.image}
                          alt={`Line ${line.index} handwritten crop`}
                          className="max-h-16 w-auto object-contain rounded"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Recognized Text Display */}
                    <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                        Recognized Text:
                      </span>
                      <p className="text-xs text-slate-100 font-mono select-all">
                        {line.text ? (
                          line.text
                        ) : (
                          <span className="text-slate-500 italic">No text recognized</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
