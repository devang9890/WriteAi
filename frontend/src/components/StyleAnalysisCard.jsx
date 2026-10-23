import React, { useState, useEffect } from 'react';

/**
 * StyleAnalysisCard Component
 * Displays the Step 5 Handwriting Style Profile extracted via OpenCV/NumPy.
 * Clearly presents stroke thickness, line/character height, spacing, slant angle,
 * density, and dominant ink color while distinguishing measured values from heuristic estimates.
 */
export default function StyleAnalysisCard({
  hasSamples,
  sampleCount,
  activeSampleFilename,
  onAnalyzeStyle,
  isLoading,
  styleData,
  error,
}) {
  const [copiedHex, setCopiedHex] = useState(false);
  const [showAnnotated, setShowAnnotated] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for elapsed duration during active analysis
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

  const handleCopyHex = (hex) => {
    if (!hex) return;
    navigator.clipboard.writeText(hex);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  const isAnalyzed = !!styleData && styleData.success;
  const metrics = styleData?.metrics;
  const dominantColor = styleData?.dominant_color;
  const summary = styleData?.summary;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                5. Handwriting Style Analysis
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Step 5 • Profile
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Analyzes stroke morphology, spacing, slant, and ink properties from original handwriting images
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAnalyzeStyle}
            disabled={!hasSamples || isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm ${
              !hasSamples || isLoading
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-600/20 shadow-md active:scale-98 cursor-pointer'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Analyzing Style... {elapsedSeconds > 0 ? `(${elapsedSeconds}s)` : ''}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{isAnalyzed ? 'Re-analyze Style' : 'Analyze Handwriting Style'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Progress State */}
      {isLoading && (
        <div className="p-8 rounded-xl bg-violet-50/50 border border-violet-100 text-center">
          <div className="inline-flex p-3 rounded-full bg-violet-100 text-violet-600 mb-3 animate-pulse">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-slate-800">Measuring Handwriting Style Profile...</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            Running distance transform ridge analysis for stroke thickness, contour regressions for baseline slope,
            and sampling un-thresholded RGB ink pixels.
          </p>
          <div className="w-48 h-1 bg-violet-200 rounded-full mx-auto mt-4 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-violet-500 to-indigo-500 animate-[pulse_1.5s_infinite]" />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && !isLoading && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs">
            <p className="font-semibold text-red-800">Style Analysis Notice</p>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State before running */}
      {!isAnalyzed && !isLoading && !error && (
        <div className="py-10 text-center text-slate-400 text-xs">
          <div className="inline-flex p-3 rounded-2xl bg-slate-100 text-slate-500 mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="font-medium text-slate-700 text-sm">No Style Profile Generated Yet</p>
          <p className="mt-1 max-w-sm mx-auto text-slate-500">
            {hasSamples
              ? `Click "Analyze Handwriting Style" to extract physical stroke metrics from ${activeSampleFilename || 'your sample'}.`
              : 'Upload a handwriting sample in Step 1 to enable style analysis.'}
          </p>
        </div>
      )}

      {/* Populated Style Profile Dashboard */}
      {isAnalyzed && !isLoading && (
        <div className="space-y-6">
          {/* Natural Language Style Overview Banner */}
          {summary && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50/80 via-indigo-50/50 to-slate-50 border border-violet-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700 block">
                  Identified Style Summary
                </span>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{summary.headline}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    ✍️ {summary.weight_label}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    📐 {summary.slant_label}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    📏 {summary.spacing_label}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    🪶 {summary.density_label}
                  </span>
                </div>
              </div>

              {/* Dominant Color Swatch Badge */}
              {dominantColor && dominantColor.hex && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs shrink-0">
                  <div
                    className="w-10 h-10 rounded-lg shadow-inner border border-black/10 shrink-0"
                    style={{ backgroundColor: dominantColor.hex }}
                    title={`Dominant Ink: ${dominantColor.hex}`}
                  />
                  <div className="text-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Dominant Ink</span>
                    <span className="font-semibold text-slate-800 block truncate max-w-[130px]">
                      {dominantColor.color_name || 'Ink Color'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyHex(dominantColor.hex)}
                      className="text-[11px] text-violet-600 hover:text-violet-800 font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy Hex Color"
                    >
                      {dominantColor.hex}
                      {copiedHex ? (
                        <span className="text-emerald-600 font-sans text-[10px]">Copied!</span>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Stroke Thickness */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stroke Width</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {metrics?.stroke_thickness?.value !== null ? (
                    <>
                      {metrics?.stroke_thickness?.value}{' '}
                      <span className="text-xs font-normal text-slate-500">{metrics?.stroke_thickness?.unit}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm">Unavailable</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                {metrics?.stroke_thickness?.description || 'Estimated pen stroke width'}
              </p>
            </div>

            {/* 2. Line Height */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Height</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {metrics?.line_height?.value !== null ? (
                    <>
                      {metrics?.line_height?.value}{' '}
                      <span className="text-xs font-normal text-slate-500">{metrics?.line_height?.unit}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm">Unavailable</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                {metrics?.line_height?.description || 'Median vertical text line extent'}
              </p>
            </div>

            {/* 3. Line Spacing */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Spacing</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {metrics?.line_spacing?.value !== null ? (
                    <>
                      {metrics?.line_spacing?.value}{' '}
                      <span className="text-xs font-normal text-slate-500">{metrics?.line_spacing?.unit}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm">Unavailable</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                {metrics?.line_spacing?.description || 'Distance between consecutive baselines'}
              </p>
            </div>

            {/* 4. Horizontal Spacing (Heuristic) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Word / Char Gap</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Heuristic
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {metrics?.horizontal_spacing?.value !== null ? (
                    <>
                      {metrics?.horizontal_spacing?.value}{' '}
                      <span className="text-xs font-normal text-slate-500">{metrics?.horizontal_spacing?.unit}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm">Unavailable</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                {metrics?.horizontal_spacing?.description || 'Statistical inter-character gap'}
              </p>
            </div>

            {/* 5. Baseline Slant Angle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Baseline Slant</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900 flex items-center gap-1.5">
                  <span>
                    {metrics?.slant_angle?.value !== null ? `${metrics?.slant_angle?.value}°` : '0°'}
                  </span>
                  <span className="text-xs font-normal text-slate-500">
                    {metrics?.slant_angle?.value > 0.5
                      ? '↗ ascending'
                      : metrics?.slant_angle?.value < -0.5
                      ? '↘ descending'
                      : '→ level'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                {metrics?.slant_angle?.description || 'Baseline inclination relative to horizontal'}
              </p>
            </div>

            {/* 6. Handwriting Density */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ink Density</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {metrics?.ink_density?.value !== null ? (
                    <>
                      {metrics?.ink_density?.value}{' '}
                      <span className="text-xs font-normal text-slate-500">ratio</span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm">Unavailable</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                {metrics?.ink_density?.description || 'Ink concentration within active line areas'}
              </p>
            </div>

            {/* 7. Page Ink Coverage */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Page Coverage</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {metrics?.ink_coverage_pct?.value !== null ? (
                    <>
                      {metrics?.ink_coverage_pct?.value}%
                    </>
                  ) : (
                    <span className="text-slate-400 text-sm">Unavailable</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                {metrics?.ink_coverage_pct?.description || 'Percentage of page area with ink strokes'}
              </p>
            </div>

            {/* 8. Lines Detected */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detected Lines</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                    Analysis
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {styleData.line_count_detected}{' '}
                  <span className="text-xs font-normal text-slate-500">lines</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                Computed in {styleData.analysis_time_sec || 0}s on original image resolution
              </p>
            </div>
          </div>

          {/* Annotated Sample Preview Toggle */}
          {styleData.annotated_sample && (
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <div
                className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setShowAnnotated((prev) => !prev)}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <span>{showAnnotated ? 'Hide Style Inspection Preview' : 'View Baseline & Line Guide Overlay'}</span>
                </div>
                <span className="text-xs text-violet-600 font-medium">
                  {showAnnotated ? 'Collapse ▲' : 'Expand ▼'}
                </span>
              </div>

              {showAnnotated && (
                <div className="p-4 bg-slate-950 flex flex-col items-center justify-center">
                  <img
                    src={styleData.annotated_sample}
                    alt="Style analysis baseline overlay"
                    className="max-h-96 w-auto object-contain rounded-lg border border-slate-800"
                  />
                  <span className="text-[11px] text-slate-400 mt-2">
                    Cyan boxes: detected line bounds • Violet lines: lower baseline regression targets
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Methodology Notice */}
          <div className="px-4 py-3 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-500 text-[11px] leading-relaxed flex items-center gap-2">
            <span className="text-sm shrink-0">🔬</span>
            <span>
              <strong>Methodology:</strong> Stroke thickness is computed using Distance Transform medial axis ridges.
              Angles are derived from linear regression on baseline ink points. No generative models or CNNs are used in this step.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
