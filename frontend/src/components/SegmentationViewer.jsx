import React, { useState } from 'react';
import { segmentHandwritingPage } from '../services/api';

export default function SegmentationViewer({
  samples = [],
  onSegmentationComplete,
}) {
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(0);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segmentationError, setSegmentationError] = useState(null);
  const [segmentResult, setSegmentResult] = useState(null);
  const [activeTab, setActiveTab] = useState('annotated'); // 'annotated' | 'lines' | 'split'
  const [highlightedLineIdx, setHighlightedLineIdx] = useState(null);

  const hasSamples = samples && samples.length > 0;
  const currentSample = hasSamples ? samples[selectedSampleIdx] || samples[0] : null;

  const handleDetectLines = async () => {
    if (!currentSample || !currentSample.file) return;

    setIsSegmenting(true);
    setSegmentationError(null);

    try {
      const response = await segmentHandwritingPage(currentSample.file);
      if (response && response.success) {
        setSegmentResult(response);
        if (onSegmentationComplete) {
          onSegmentationComplete(response);
        }
      } else {
        setSegmentResult(response);
        setSegmentationError(
          response?.message || 'No handwriting lines could be detected in this sample.'
        );
      }
    } catch (err) {
      setSegmentationError(
        err.message || 'An error occurred while segmenting the handwriting page.'
      );
      setSegmentResult(null);
    } finally {
      setIsSegmenting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-violet-600 font-semibold text-xs tracking-wider uppercase">
              Step 3
            </span>
            <span className="w-1 h-1 rounded-full bg-violet-400" />
            <span className="text-xs text-slate-500 font-medium">Page Segmentation</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            3. Handwriting Page Segmentation
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Detect and extract handwritten text lines from your full page samples using classical computer vision.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDetectLines}
            disabled={!hasSamples || isSegmenting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shadow-xs hover:shadow transition-all duration-200"
          >
            {isSegmenting ? (
              <>
                <svg
                  className="animate-spin -ml-0.5 mr-1 h-4 w-4 text-white"
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
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Detecting handwriting lines...</span>
              </>
            ) : (
              <>
                <span>📐</span>
                <span>Detect Handwriting Lines</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sample Selector (if multiple samples uploaded) */}
      {hasSamples && samples.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <span className="text-xs text-slate-400 font-medium shrink-0">Sample Page:</span>
          {samples.map((s, idx) => (
            <button
              key={s.id || idx}
              type="button"
              onClick={() => {
                setSelectedSampleIdx(idx);
                setSegmentResult(null);
                setSegmentationError(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                selectedSampleIdx === idx
                  ? 'bg-violet-50 text-violet-700 border-violet-200 ring-2 ring-violet-500/10'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              📄 {s.name || `Sample ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Empty State when no samples uploaded */}
      {!hasSamples && (
        <div className="min-h-[220px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400 text-2xl mb-2">
            📄
          </div>
          <h3 className="text-sm font-bold text-slate-700">No samples available</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Upload your handwriting samples in Step 1 above to analyze and extract handwriting lines.
          </p>
        </div>
      )}

      {/* Error / No Lines Detected Banner */}
      {segmentationError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-start gap-3">
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <span className="font-bold block mb-0.5">Line Detection Notice:</span>
            <p className="text-amber-700 leading-relaxed">{segmentationError}</p>
          </div>
        </div>
      )}

      {/* Loading State Skeleton */}
      {isSegmenting && (
        <div className="min-h-[260px] rounded-2xl border border-slate-200 bg-slate-50/50 p-8 flex flex-col items-center justify-center text-center animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 text-2xl mb-3 shadow-xs">
            📐
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Detecting handwriting lines...
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Applying horizontal projection analysis, connected component grouping, and bounding box extraction.
          </p>
        </div>
      )}

      {/* Results View */}
      {!isSegmenting && segmentResult && segmentResult.success && (
        <div className="flex flex-col gap-6">
          {/* Summary Stat Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-violet-50/60 border border-violet-100">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                ✓
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Detected {segmentResult.line_count} handwriting line
                  {segmentResult.line_count === 1 ? '' : 's'}
                </h4>
                <p className="text-xs text-slate-500">
                  File: <span className="font-mono text-slate-700">{segmentResult.filename}</span>
                  {segmentResult.original_size && (
                    <span>
                      {' '}
                      • {segmentResult.original_size.width} × {segmentResult.original_size.height} px
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('annotated')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'annotated'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Annotated Page
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lines')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'lines'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cropped Lines ({segmentResult.line_count})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === 'split'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Side-by-Side
              </button>
            </div>
          </div>

          {/* Tab 1: Annotated Full Page View */}
          {(activeTab === 'annotated' || activeTab === 'split') && (
            <div className={activeTab === 'split' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Annotated Page with Line Bounding Boxes
                  </span>
                  <span className="text-xs text-slate-500">
                    Violet boxes indicate segmented lines
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 flex items-center justify-center p-2 shadow-inner">
                  {segmentResult.annotated_image ? (
                    <img
                      src={segmentResult.annotated_image}
                      alt="Annotated handwriting lines"
                      className="max-h-[550px] w-auto object-contain rounded-lg"
                    />
                  ) : (
                    <div className="p-8 text-xs text-slate-400">No preview available</div>
                  )}
                </div>
              </div>

              {activeTab === 'split' && (
                <div className="flex flex-col gap-3 max-h-[590px] overflow-y-auto pr-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Extracted Lines ({segmentResult.lines.length})
                  </span>
                  {segmentResult.lines.map((line) => (
                    <div
                      key={line.index}
                      onMouseEnter={() => setHighlightedLineIdx(line.index)}
                      onMouseLeave={() => setHighlightedLineIdx(null)}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-violet-50/40 hover:border-violet-200 transition-all flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">
                          Line {line.index}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          x:{line.bbox.x} y:{line.bbox.y} • {line.bbox.width}×{line.bbox.height}px
                        </span>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-slate-200/80 overflow-hidden flex items-center justify-center">
                        <img
                          src={line.image}
                          alt={`Line ${line.index}`}
                          className="max-h-20 w-auto object-contain"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Cropped Lines Grid / List View */}
          {activeTab === 'lines' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Detected Line Crops (Preserving Original Ink Resolution)
                </span>
                <span className="text-xs text-slate-500">
                  Ready for handwriting style analysis & embeddings
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {segmentResult.lines.map((line) => (
                  <div
                    key={line.index}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:border-violet-300 hover:shadow-xs transition-all flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-violet-600 text-white font-bold text-xs flex items-center justify-center">
                          {line.index}
                        </span>
                        <span className="font-bold text-slate-800">
                          Line {line.index}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                        bbox: [{line.bbox.x}, {line.bbox.y}, {line.bbox.width}, {line.bbox.height}]
                      </span>
                    </div>

                    <div className="rounded-lg bg-white p-3 border border-slate-200/80 flex items-center justify-center overflow-x-auto min-h-[70px]">
                      <img
                        src={line.image}
                        alt={`Extracted Line ${line.index}`}
                        className="max-h-24 w-auto object-contain"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
