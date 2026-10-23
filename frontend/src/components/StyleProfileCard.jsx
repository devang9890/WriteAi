import React, { useState, useEffect } from 'react';

/**
 * StyleProfileCard Component
 * Step 7 — Personalized Handwriting Style Profile
 *
 * Combines 512-dimensional CNN ResNet-18 visual embeddings and classical morphological
 * measurements (stroke width, line height, spacing, slant, ink density, coverage)
 * across multiple handwriting samples into a unified, persistent profile.
 */
export default function StyleProfileCard({
  profileData,
  isLoading,
  error,
  hasUploadedSamples,
  uploadedCount,
  onBuildProfile,
  onRefreshProfile,
  onDeleteProfile,
}) {
  const [showFullEmbedding, setShowFullEmbedding] = useState(false);
  const [copiedEmbedding, setCopiedEmbedding] = useState(false);
  const [showLimitations, setShowLimitations] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Active elapsed timer during generation
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

  const handleCopyEmbedding = () => {
    if (!profileData?.embedding || profileData.embedding.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify(profileData.embedding, null, 2));
    setCopiedEmbedding(true);
    setTimeout(() => setCopiedEmbedding(false), 2500);
  };

  // Determine status
  const status = isLoading
    ? 'processing'
    : error
    ? 'error'
    : profileData && profileData.status === 'ready'
    ? 'ready'
    : 'not_created';

  const metrics = profileData?.aggregated_metrics;
  const comparisons = profileData?.sample_comparisons || [];
  const validCount = profileData?.valid_samples_count ?? profileData?.valid_sample_count ?? 0;
  const totalAnalyzed = profileData?.total_samples_analyzed ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200/60">
                  Step 7
                </span>
                <h3 className="text-lg font-bold text-slate-800">Personalized Handwriting Style Profile</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Unified writer descriptor combining classical morphology medians and 512-D CNN visual embeddings.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh saved state */}
          <button
            type="button"
            onClick={onRefreshProfile}
            disabled={isLoading}
            title="Refresh persisted profile from server"
            className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-slate-400' : 'text-slate-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Refresh</span>
          </button>

          {/* Delete / Reset */}
          {status === 'ready' && (
            <button
              type="button"
              onClick={onDeleteProfile}
              disabled={isLoading}
              title="Delete persisted profile"
              className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>Reset</span>
            </button>
          )}

          {/* Create / Rebuild Profile */}
          <button
            type="button"
            onClick={onBuildProfile}
            disabled={isLoading || !hasUploadedSamples}
            className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Building Profile ({elapsedSeconds}s)...</span>
              </>
            ) : status === 'ready' ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Rebuild Style Profile</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate Style Profile</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Profile Status:</span>
          {status === 'ready' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ready & Persisted
            </span>
          )}
          {status === 'processing' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-amber-700 bg-amber-50 border border-amber-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              Processing Multi-Sample Profile...
            </span>
          )}
          {status === 'not_created' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-600 bg-slate-100 border border-slate-200 font-medium">
              Not Created
            </span>
          )}
          {status === 'error' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-rose-700 bg-rose-50 border border-rose-200 font-semibold">
              Error Building Profile
            </span>
          )}
        </div>

        {status === 'ready' && (
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <span>
              Samples Valid: <strong className="text-slate-700">{validCount}</strong> of {totalAnalyzed}
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Embedding: <strong className="text-slate-700">512 dimensions</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Updated: <strong className="text-slate-700">{profileData?.updated_at ? new Date(profileData.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-3">
          <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h4 className="font-bold text-rose-800">Profile Construction Error</h4>
            <p className="mt-0.5 text-rose-600">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {status === 'not_created' && !error && (
        <div className="p-8 text-center bg-slate-50/60 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h4 className="text-sm font-bold text-slate-700">No Handwriting Profile Created Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-4 leading-relaxed">
            {hasUploadedSamples
              ? `You have ${uploadedCount} uploaded handwriting page${uploadedCount > 1 ? 's' : ''}. Click "Generate Style Profile" to compute median morphology metrics and 512-D CNN embeddings.`
              : 'Please upload one or more handwriting samples in Step 1 to generate and persist your personalized style profile.'}
          </p>
          <button
            type="button"
            onClick={onBuildProfile}
            disabled={!hasUploadedSamples || isLoading}
            className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Personalized Style Profile
          </button>
        </div>
      )}

      {/* Main Content: Profile is Ready */}
      {status === 'ready' && (
        <div className="flex flex-col gap-6">
          {/* Scientific Disclaimer & Transparency Callout */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-3">
            <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <span className="font-semibold text-indigo-950">Scientific Representation: </span>
              <span>
                This profile combines <strong>directly measured image statistics</strong> (stroke thickness, line height, spacing, slant via OpenCV/NumPy),
                an <strong>empirical heuristic</strong> for horizontal word gap, and <strong>general visual representations</strong> from an ImageNet-pretrained ResNet-18 backbone.
                It is an empirical style descriptor, not a validated biometric identity model or handwriting synthesis generator.
              </span>
            </div>
          </div>

          {/* Aggregated Metrics Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Aggregated Handwriting Metrics (Sample Medians)
              </h4>
              <span className="text-[11px] text-slate-400">
                Method: {profileData?.aggregation_method || 'Median Statistics'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Stroke Thickness */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Stroke Width</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-slate-800">
                      {metrics?.stroke_thickness?.value ?? '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{metrics?.stroke_thickness?.unit || 'px'}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                  <span className="text-[10px] text-slate-400">Morphological Skeleton</span>
                </div>
              </div>

              {/* Median Line Height */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Line Height</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-slate-800">
                      {metrics?.line_height?.value ?? '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{metrics?.line_height?.unit || 'px'}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                  <span className="text-[10px] text-slate-400">Median Bounding Box</span>
                </div>
              </div>

              {/* Median Line Spacing */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Line Spacing</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-slate-800">
                      {metrics?.line_spacing?.value ?? '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{metrics?.line_spacing?.unit || 'px'}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                  <span className="text-[10px] text-slate-400">Inter-Baseline Gap</span>
                </div>
              </div>

              {/* Baseline Slant */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Baseline Slant</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-slate-800">
                      {metrics?.slant_angle?.value !== null && metrics?.slant_angle?.value !== undefined
                        ? `${metrics.slant_angle.value > 0 ? '+' : ''}${metrics.slant_angle.value}°`
                        : '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">deg</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                  <span className="text-[10px] text-slate-400">PCA / Linear Fit</span>
                </div>
              </div>

              {/* Foreground Ink Density */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ink Density</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-slate-800">
                      {metrics?.ink_density?.value !== null && metrics?.ink_density?.value !== undefined
                        ? (metrics.ink_density.value * 100).toFixed(1)
                        : '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">% in lines</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                  <span className="text-[10px] text-slate-400">Otsu Ink Ratio</span>
                </div>
              </div>

              {/* Page Coverage */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Page Coverage</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-slate-800">
                      {metrics?.ink_coverage_pct?.value ?? '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">% of page</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                  <span className="text-[10px] text-slate-400">Total Ink Pixels</span>
                </div>
              </div>

              {/* Estimated Horizontal Word Gap */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Word / Char Gap</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-slate-800">
                      {metrics?.horizontal_spacing?.value ?? '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{metrics?.horizontal_spacing?.unit || 'px'}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Heuristic
                  </span>
                  <span className="text-[10px] text-slate-400">Valley Estimation</span>
                </div>
              </div>

              {/* Dominant Ink Color */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Dominant Ink</span>
                  <div className="flex items-center gap-2 mt-1.5">
                    {profileData?.dominant_color?.hex ? (
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                        style={{ backgroundColor: profileData.dominant_color.hex }}
                      />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-slate-300 shrink-0" />
                    )}
                    <span className="text-sm font-bold text-slate-800 truncate">
                      {profileData?.dominant_color?.color_name || 'Dark Ink'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Measured
                  </span>
                  <span className="text-[10px] text-slate-400">{profileData?.dominant_color?.hex || 'RGB Mode'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CNN Embedding Vector Section */}
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                <h4 className="text-xs font-bold text-slate-800">
                  Pooled 512-Dimensional Visual Style Embedding (ResNet-18)
                </h4>
                <span className="text-[11px] px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold border border-violet-200">
                  L2-Normalized
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEmbedding}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copiedEmbedding ? 'Copied JSON!' : 'Copy Vector'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullEmbedding(!showFullEmbedding)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                >
                  {showFullEmbedding ? 'Hide Values' : 'View Dimensions'}
                </button>
              </div>
            </div>

            {/* Preview values chips */}
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              {(showFullEmbedding
                ? profileData.embedding
                : (profileData.preview_values || profileData.embedding.slice(0, 16))
              ).map((val, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shadow-2xs"
                >
                  <span className="text-slate-400 text-[9px] mr-1">d{idx}:</span>
                  {typeof val === 'number' ? val.toFixed(4) : val}
                </span>
              ))}
              {!showFullEmbedding && profileData.embedding.length > 16 && (
                <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100 text-[10px] font-semibold flex items-center">
                  + {profileData.embedding.length - 16} more dimensions...
                </span>
              )}
            </div>
          </div>

          {/* Compact Sample-by-Sample Comparison Table */}
          {comparisons.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Sample Comparison & Consistency Matrix
                </h4>
                <span className="text-[11px] text-slate-400">
                  {validCount} of {comparisons.length} valid sample{comparisons.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-3">Sample Name</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Stroke</th>
                      <th className="py-2.5 px-3 text-right">Line H</th>
                      <th className="py-2.5 px-3 text-right">Line Spacing</th>
                      <th className="py-2.5 px-3 text-right">Slant</th>
                      <th className="py-2.5 px-3 text-right">Ink Density</th>
                      <th className="py-2.5 px-3 text-center">Profile Cosine Similarity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Unified Profile Benchmark Row */}
                    <tr className="bg-violet-50/50 font-semibold text-slate-800">
                      <td className="py-2.5 px-3 flex items-center gap-1.5 text-violet-900">
                        <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                        Aggregated Writer Profile
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                          Median Target
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">{metrics?.stroke_thickness?.value ? `${metrics.stroke_thickness.value} px` : '—'}</td>
                      <td className="py-2.5 px-3 text-right">{metrics?.line_height?.value ? `${metrics.line_height.value} px` : '—'}</td>
                      <td className="py-2.5 px-3 text-right">{metrics?.line_spacing?.value ? `${metrics.line_spacing.value} px` : '—'}</td>
                      <td className="py-2.5 px-3 text-right">{metrics?.slant_angle?.value !== null && metrics?.slant_angle?.value !== undefined ? `${metrics.slant_angle.value}°` : '—'}</td>
                      <td className="py-2.5 px-3 text-right">{metrics?.ink_density?.value ? `${(metrics.ink_density.value * 100).toFixed(1)}%` : '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-bold text-violet-700">100.0% (1.000)</span>
                      </td>
                    </tr>

                    {/* Individual Samples */}
                    {comparisons.map((item, idx) => {
                      const sim = item.cosine_similarity ?? item.similarity_to_profile;
                      const simPct = sim !== null && sim !== undefined ? Math.round(sim * 100) : null;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 px-3 font-medium text-slate-700 truncate max-w-[150px]" title={item.filename}>
                            {item.filename}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.success ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Valid
                              </span>
                            ) : (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                                title={item.message || 'Sample rejected'}
                              >
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {item.stroke_thickness_px ? `${item.stroke_thickness_px} px` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {item.line_height_px ? `${item.line_height_px} px` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {item.line_spacing_px ? `${item.line_spacing_px} px` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {item.slant_angle_deg !== null && item.slant_angle_deg !== undefined ? `${item.slant_angle_deg}°` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {item.ink_density_ratio ? `${(item.ink_density_ratio * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.success && simPct !== null ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      simPct >= 85 ? 'bg-emerald-500' : simPct >= 70 ? 'bg-amber-500' : 'bg-slate-400'
                                    }`}
                                    style={{ width: `${simPct}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-[11px] text-slate-700">
                                  {simPct}% ({sim.toFixed(3)})
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
