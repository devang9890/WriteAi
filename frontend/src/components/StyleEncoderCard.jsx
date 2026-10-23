import React, { useState, useEffect } from 'react';

/**
 * StyleEncoderCard Component
 * Step 6: CNN-Based Handwriting Style Encoder
 *
 * Extracts a 512-dimensional numerical feature vector using a pretrained ResNet-18
 * convolutional neural network and Global Average Pooling.
 *
 * Displays embedding metrics, mini feature spectrum, per-sample status for multi-page
 * uploads, and clearly states machine learning boundaries (generic visual features vs writer identity).
 */
export default function StyleEncoderCard({
  hasSamples,
  sampleCount,
  onExtractEmbedding,
  isLoading,
  encoderData,
  error,
}) {
  const [copiedVector, setCopiedVector] = useState(false);
  const [showFullVector, setShowFullVector] = useState(false);
  const [showConceptGuide, setShowConceptGuide] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Active elapsed timer
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

  const handleCopyVector = () => {
    if (!encoderData?.embedding || encoderData.embedding.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify(encoderData.embedding, null, 2));
    setCopiedVector(true);
    setTimeout(() => setCopiedVector(false), 2500);
  };

  const isEncoded = !!encoderData && encoderData.success;
  const stats = encoderData?.statistics;

  // Take 32 evenly-spaced samples across the 512 dimensions for the visual spectrum
  const spectrumBars = React.useMemo(() => {
    if (!encoderData?.embedding || encoderData.embedding.length < 512) return [];
    const step = Math.floor(512 / 32);
    const bars = [];
    const maxVal = Math.max(...encoderData.embedding.map(Math.abs), 0.001);
    for (let i = 0; i < 32; i++) {
      const val = encoderData.embedding[i * step] || 0;
      const heightPct = Math.min(100, Math.max(8, Math.round((Math.abs(val) / maxVal) * 100)));
      bars.push({ idx: i * step, val, heightPct });
    }
    return bars;
  }, [encoderData?.embedding]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                6. CNN Handwriting Style Encoder
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Step 6 • ResNet-18
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Extracts 512-D deep visual feature representations from handwriting strokes using convolutional neural networks
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExtractEmbedding}
            disabled={!hasSamples || isLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-sm ${
              !hasSamples || isLoading
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/20 shadow-md active:scale-98 cursor-pointer'
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
                <span>Extracting Features... {elapsedSeconds > 0 ? `(${elapsedSeconds}s)` : ''}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{isEncoded ? 'Re-extract CNN Embeddings' : 'Extract Style Embedding'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Progress State */}
      {isLoading && (
        <div className="p-8 rounded-xl bg-indigo-50/50 border border-indigo-100 text-center">
          <div className="inline-flex p-3 rounded-full bg-indigo-100 text-indigo-600 mb-3 animate-pulse">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-slate-800">Running ResNet-18 Feature Extraction...</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            Scanning handwriting stroke contours through 18 convolutional layers and applying Global Average Pooling (GAP)
            across {sampleCount} uploaded sample{sampleCount > 1 ? 's' : ''}.
          </p>
          <div className="w-48 h-1 bg-indigo-200 rounded-full mx-auto mt-4 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-[pulse_1.5s_infinite]" />
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && !isLoading && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs">
            <p className="font-semibold text-red-800">Style Encoder Notice</p>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State before running */}
      {!isEncoded && !isLoading && !error && (
        <div className="py-10 text-center text-slate-400 text-xs">
          <div className="inline-flex p-3 rounded-2xl bg-slate-100 text-slate-500 mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-medium text-slate-700 text-sm">No CNN Style Embedding Extracted Yet</p>
          <p className="mt-1 max-w-sm mx-auto text-slate-500">
            {hasSamples
              ? `Click "Extract Style Embedding" to generate a 512-D neural feature vector across your ${sampleCount} uploaded handwriting sample${sampleCount > 1 ? 's' : ''}.`
              : 'Upload handwriting samples in Step 1 to enable CNN style feature extraction.'}
          </p>
        </div>
      )}

      {/* Populated Results View */}
      {isEncoded && !isLoading && (
        <div className="space-y-6">
          {/* Metadata Diagnostic Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Backbone Architecture</span>
              <span className="font-semibold text-slate-800 truncate block mt-0.5">
                {encoderData.model_name}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Weights Source</span>
              <span className="font-semibold text-emerald-700 block mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {encoderData.is_pretrained ? 'ImageNet Pretrained' : 'Untrained Fallback'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Embedding Dimensions</span>
              <span className="font-semibold text-indigo-700 block mt-0.5 font-mono">
                {encoderData.embedding_dim}-D Vector
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Combined Samples</span>
              <span className="font-semibold text-slate-800 block mt-0.5">
                {encoderData.successful_samples} of {encoderData.total_samples_received} valid
              </span>
            </div>
          </div>

          {/* Feature Vector Visual Spectrum (32-bin sampled activation chart) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Neural Feature Activation Spectrum (Sampled 32 Bins of 512-D)
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Relative activation magnitudes after Global Average Pooling and L2 normalization
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                <span>Active: {stats?.active_features_count || 0}/512</span>
                <span>L2 Norm: {stats?.l2_norm || 1.0}</span>
              </div>
            </div>

            {/* Mini Spectrum Bars */}
            <div className="h-16 w-full flex items-end gap-1 px-1 bg-white rounded-lg border border-slate-200/80 p-2">
              {spectrumBars.map((bar) => (
                <div
                  key={bar.idx}
                  className="flex-1 bg-gradient-to-t from-indigo-600 to-violet-400 rounded-t hover:from-indigo-500 hover:to-violet-300 transition-all cursor-pointer relative group"
                  style={{ height: `${bar.heightPct}%` }}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow-md font-mono">
                    dim[{bar.idx}]: {bar.val.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Vector Preview Box */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                Embedding Vector Preview (first 16 components):
              </span>
              <button
                type="button"
                onClick={handleCopyVector}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Copy full 512-D numerical vector as JSON"
              >
                {copiedVector ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400 font-sans">Copied JSON!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="font-sans">Copy 512-D Vector</span>
                  </>
                )}
              </button>
            </div>

            {/* Formatted Preview Array */}
            <div className="font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-800 text-indigo-300 leading-relaxed overflow-x-auto">
              [
              {encoderData.preview_values?.map((val, i) => (
                <span key={i} className="text-slate-200 mx-1">
                  {val.toFixed(4)}
                  {i < encoderData.preview_values.length - 1 ? ',' : ''}
                </span>
              ))}
              <span className="text-slate-500">... +496 more dimensions</span>
              ]
            </div>

            {/* Expandable full vector viewer */}
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => setShowFullVector((prev) => !prev)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                {showFullVector ? 'Collapse full 512-D vector ▲' : 'Inspect all 512 numerical values ▼'}
              </button>
            </div>

            {showFullVector && (
              <div className="mt-2 max-h-44 overflow-y-auto p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 select-all">
                {JSON.stringify(encoderData.embedding, null, 2)}
              </div>
            )}
          </div>

          {/* Multi-sample aggregation details if multiple samples */}
          {encoderData.sample_details && encoderData.sample_details.length > 1 && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700 block mb-2">
                Multi-Sample Pooling Breakdown ({encoderData.aggregation_method}):
              </span>
              <div className="space-y-1.5">
                {encoderData.sample_details.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80"
                  >
                    <span className="font-medium text-slate-700 truncate max-w-xs">{s.filename}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-mono">
                        L2 Norm: {s.l2_norm || 'N/A'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {s.success ? 'Included' : 'Excluded'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Machine Learning Honesty & Limitations Notice */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-3">
            <span className="text-base shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="font-bold text-amber-950">Machine Learning Context & Scientific Limitation</p>
              <p className="mt-0.5 text-amber-800">
                {encoderData.ml_limitations_notice}
              </p>
              <p className="mt-1 text-amber-700 text-[11px]">
                In future steps, this feature representation will be paired with writer-identification contrastive
                fine-tuning and conditioning inputs for personalized handwriting synthesis.
              </p>
            </div>
          </div>

          {/* Educational Concept Guide Accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowConceptGuide((prev) => !prev)}
              className="w-full bg-slate-50 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span>Deep Learning Concepts: How Convolutions, Feature Maps & Pooling Work</span>
              <span className="text-indigo-600">{showConceptGuide ? 'Collapse ▲' : 'Learn More ▼'}</span>
            </button>

            {showConceptGuide && (
              <div className="p-4 text-xs text-slate-600 bg-white space-y-2.5 leading-relaxed border-t border-slate-200">
                <p>
                  <strong>1. Convolutional Kernels:</strong> 2D spatial filters sweep over the handwriting sample to detect
                  ink edges, stroke curvature, loops, and pen inclinations at multiple spatial resolutions.
                </p>
                <p>
                  <strong>2. Feature Maps:</strong> Intermediate 3D tensors representing the activation density of learned stroke patterns across the image.
                </p>
                <p>
                  <strong>3. Global Average Pooling (GAP):</strong> Averages each feature map across the page, compressing the spatial grid into a fixed 512-D vector invariant to where text was written.
                </p>
                <p>
                  <strong>4. L2 Normalization:</strong> Projects the 512-D vector onto a unit sphere, enabling direct cosine similarity comparisons across writing styles.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
