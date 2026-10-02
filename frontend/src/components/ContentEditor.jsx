import React, { useState } from 'react';

export default function ContentEditor({ text, onChangeText }) {
  const [paperSize, setPaperSize] = useState('A4');
  const [orientation, setOrientation] = useState('Portrait');
  const [lineSpacing, setLineSpacing] = useState('Normal');

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  // Estimated page count calculation (rough guideline for A4 handwriting: ~220 words per page)
  const estimatedPages = wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / 220));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            4. Enter Your Notes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Enter the text you want WriteAI to turn into handwritten pages.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            {wordCount} words
          </span>
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            {charCount} characters
          </span>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          rows={8}
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Paste your notes, assignment, study material, or any other text here..."
          className="w-full rounded-xl border border-slate-200 p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-y leading-relaxed"
        />
        {text && (
          <button
            type="button"
            onClick={() => onChangeText('')}
            className="absolute top-3 right-3 text-xs text-slate-400 hover:text-slate-600 bg-white/90 px-2 py-1 rounded-md border border-slate-200 transition-colors"
          >
            Clear Text
          </button>
        )}
      </div>

      {/* Formatting & Layout Controls (UI-only for Step 1) */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Paper Size */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Paper size:</span>
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="A4">A4 (Standard)</option>
              <option value="Letter">US Letter</option>
              <option value="A5">A5 (Notebook)</option>
            </select>
          </div>

          {/* Orientation */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Orientation:</span>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="Portrait">Portrait</option>
              <option value="Landscape">Landscape</option>
            </select>
          </div>

          {/* Line Spacing */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Line spacing:</span>
            <select
              value={lineSpacing}
              onChange={(e) => setLineSpacing(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="Compact">Compact</option>
              <option value="Normal">Normal</option>
              <option value="Wide">Wide (Ruled)</option>
            </select>
          </div>
        </div>

        {/* Pages dynamic auto estimate */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className="text-slate-400">Pages:</span>
          <span className="bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-lg">
            {estimatedPages === 0 ? 'Auto' : `Auto (~${estimatedPages} ${estimatedPages === 1 ? 'page' : 'pages'})`}
          </span>
        </div>
      </div>
    </div>
  );
}
