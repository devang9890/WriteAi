import React, { useState, useEffect } from 'react';

/**
 * GenerationCard Component
 * Step 8: Handwriting Generation Engine
 *
 * Provides page styling controls (paper style, handwriting font style, ink color, profile personalization)
 * and triggers the real backend Pillow handwriting generation engine.
 */
export default function GenerationCard({
  hasContent,
  hasProfile,
  profileData,
  onGenerate,
  isLoading,
  error,
}) {
  const [pageStyle, setPageStyle] = useState('ruled');
  const [fontFamily, setFontFamily] = useState('cursive');
  const [inkColorChoice, setInkColorChoice] = useState('profile'); // 'profile' | '#1c345e' | '#1d4ed8' | '#0f172a'
  const [useProfile, setUseProfile] = useState(true);
  const [validationError, setValidationError] = useState('');
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

  const handleGenerateClick = () => {
    if (!hasContent) {
      setValidationError('Please enter some text in the notes editor before generating.');
      return;
    }
    setValidationError('');

    const options = {
      fontFamily,
      pageStyle,
      inkColor: inkColorChoice === 'profile' ? null : inkColorChoice,
      useProfile: useProfile && hasProfile,
      profileId: profileData?.profile_id || 'default_writer',
    };

    onGenerate(options);
  };

  const dominantColorName = profileData?.dominant_color?.color_name || 'Dark Ballpoint Navy';
  const dominantColorHex = profileData?.dominant_color?.hex || '#1c345e';

  return (
    <div className="bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden flex flex-col gap-6">
      {/* Subtle background decoration */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-violet-300 font-semibold text-xs tracking-wider uppercase bg-violet-500/20 px-2.5 py-0.5 rounded-full border border-violet-400/30">
              Step 8
            </span>
            <span className="w-1 h-1 rounded-full bg-violet-400" />
            <span className="text-xs text-slate-300 font-medium">Parametric Engine v2.0</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            Handwriting Generation Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-0.5">
            Render your notes into personalized handwritten A4 pages with connected cursive script, ballpoint stroke dilation, and typographic baseline anchoring.
          </p>
        </div>

        {/* Profile Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {hasProfile ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Profile Active ({dominantColorName})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium">
              <span>Standard Baseline (No Profile)</span>
            </div>
          )}
        </div>
      </div>

      {/* Style & Layout Controls Grid */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Paper Background Style */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
          <label className="font-semibold text-slate-300">Paper Style</label>
          <select
            value={pageStyle}
            onChange={(e) => setPageStyle(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg bg-slate-800/90 border border-slate-700 px-3 py-2 text-white font-medium focus:outline-none focus:border-violet-400 transition cursor-pointer"
          >
            <option value="ruled">Ruled Notebook (Lined)</option>
            <option value="plain">Plain White Paper (Matches Reference)</option>
            <option value="blank">Blank Ivory Parchment</option>
            <option value="grid">Engineering Grid (5mm)</option>
          </select>
          <span className="text-[10px] text-slate-400">Baseline rests on rule lines</span>
        </div>

        {/* Handwriting Font Style */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
          <label className="font-semibold text-slate-300">Handwriting Style</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg bg-slate-800/90 border border-slate-700 px-3 py-2 text-white font-medium focus:outline-none focus:border-violet-400 transition cursor-pointer"
          >
            <option value="cursive">Cursive Flow (Segoe Script / Connected)</option>
            <option value="casual">Casual Script (Ink Free)</option>
            <option value="fluid">Fluid Script (Freestyle Script)</option>
            <option value="print">Neat Print (Segoe Print)</option>
          </select>
          <span className="text-[10px] text-slate-400">Connected strokes & natural wave</span>
        </div>

        {/* Ink Color */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
          <label className="font-semibold text-slate-300">Ink Color</label>
          <select
            value={inkColorChoice}
            onChange={(e) => setInkColorChoice(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg bg-slate-800/90 border border-slate-700 px-3 py-2 text-white font-medium focus:outline-none focus:border-violet-400 transition cursor-pointer"
          >
            <option value="profile">
              {hasProfile ? `Auto Profile (${dominantColorName})` : 'Auto Ballpoint Navy (#1c345e)'}
            </option>
            <option value="#1c345e">Pentonic Ballpoint Blue (#1c345e)</option>
            <option value="#1d4ed8">Royal Blue (#1d4ed8)</option>
            <option value="#0f172a">Deep Black Gel Pen (#0f172a)</option>
            <option value="#334155">Pencil Slate Gray (#334155)</option>
          </select>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="w-3 h-3 rounded-full border border-white/30 shrink-0"
              style={{
                backgroundColor:
                  inkColorChoice === 'profile'
                    ? hasProfile
                      ? dominantColorHex
                      : '#1c345e'
                    : inkColorChoice,
              }}
            />
            <span className="text-[10px] text-slate-400">Color swatch preview</span>
          </div>
        </div>

        {/* Profile Personalization Toggle */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-white/5 border border-white/10">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">Step 7 Personalization</label>
            <span className="text-[10px] text-slate-400 block leading-tight">
              Apply measured stroke thickness, dominant ink color, and median line geometry.
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="use-profile-toggle"
              checked={useProfile && hasProfile}
              disabled={!hasProfile || isLoading}
              onChange={(e) => setUseProfile(e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-slate-800 border-slate-700 cursor-pointer disabled:opacity-40"
            />
            <label
              htmlFor="use-profile-toggle"
              className={`text-xs font-medium cursor-pointer ${
                hasProfile ? 'text-white' : 'text-slate-500'
              }`}
            >
              {hasProfile ? 'Apply Personal Profile' : 'No Profile Available'}
            </label>
          </div>
        </div>
      </div>

      {/* Validation or Error Message */}
      {(validationError || error) && (
        <div className="relative z-10 rounded-xl bg-rose-500/20 border border-rose-400/40 p-3.5 text-xs text-rose-200 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">⚠️</span>
            <span className="font-medium text-rose-100">{validationError || error}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError('')}
            className="text-rose-300 hover:text-white p-1 rounded transition text-base font-bold leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Bottom Bar: Action & Status Guidance */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
        <div className="text-xs text-slate-300/80 flex items-center gap-2">
          <span>💡</span>
          <span>
            {!hasContent
              ? 'Enter or paste text in the Notes Editor (Step 4) to enable page generation.'
              : hasProfile
              ? 'Ready: Content and personalized style profile are prepared for generation.'
              : 'Ready: Content prepared. Will render using clean baseline handwriting typography.'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleGenerateClick}
          disabled={isLoading || !hasContent}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-violet-200 via-white to-indigo-100 hover:from-white hover:to-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin text-slate-900" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Rendering Handwritten Pages ({elapsedSeconds}s)...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>Generate Handwritten Notes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
