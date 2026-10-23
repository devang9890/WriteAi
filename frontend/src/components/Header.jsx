import React from 'react';

export default function Header({ backendConnected, isBusy, busyMessage }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200/80 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-violet-500/25 text-white">
            <svg
              className="w-5 h-5 fill-none stroke-current stroke-2"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              Write<span className="text-violet-600">AI</span>
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              v1.0
            </span>
          </div>
        </div>

        {/* Right Status & Navigation */}
        <div className="flex items-center gap-4">
          {isBusy ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-500/10">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>{busyMessage || 'Backend Busy — Processing OCR'}</span>
            </div>
          ) : (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                backendConnected
                  ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50/80 text-rose-700 border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{backendConnected ? 'Backend Connected' : 'Backend Disconnected'}</span>
            </div>
          )}

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-slate-600 hover:text-violet-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            Docs
          </a>
        </div>
      </div>
    </header>
  );
}
