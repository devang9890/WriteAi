import React from 'react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-violet-50/70 via-indigo-50/30 to-white border border-violet-100/80 p-8 sm:p-12">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Text */}
        <div className="flex-1 text-center md:text-left space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-semibold border border-violet-200">
            <span>✨</span>
            <span>Your handwriting. Your words. AI generated.</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Turn your handwriting into{' '}
            <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
              AI-generated notes.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
            Upload your handwriting samples, teach WriteAI your writing style, and generate new handwritten pages from typed text.
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-1 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              100% Personal Handwriting Style
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Custom Pen & Paper Synthesis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              PNG / Multi-Page PDF Export
            </span>
          </div>
        </div>

        {/* Right: CSS & SVG Handwriting Visual */}
        <div className="shrink-0 w-64 sm:w-72">
          <div className="relative bg-white rounded-2xl p-5 shadow-xl shadow-indigo-500/10 border border-slate-200/90 rotate-1 hover:rotate-0 transition-transform duration-300">
            {/* Paper Margin Red Line */}
            <div className="absolute top-0 bottom-0 left-8 w-[1.5px] bg-rose-200/80" />

            {/* Notebook lines */}
            <div className="space-y-3.5 pt-1 pl-6">
              <div className="h-2 w-28 bg-slate-200 rounded-full" />
              
              {/* Handwriting waveform/sample */}
              <svg
                className="w-full h-8 stroke-violet-600 fill-none stroke-[2.2] overflow-visible"
                viewBox="0 0 200 40"
              >
                <path
                  d="M10 25 Q 25 5, 40 25 T 70 25 T 100 15 T 130 28 T 160 20 T 190 25"
                  strokeLinecap="round"
                />
              </svg>

              <div className="h-2 w-36 bg-slate-100 rounded-full" />

              <svg
                className="w-full h-8 stroke-indigo-600 fill-none stroke-[2] overflow-visible opacity-90"
                viewBox="0 0 200 40"
              >
                <path
                  d="M15 20 Q 35 32, 55 18 T 90 24 T 120 16 T 150 22 T 185 18"
                  strokeLinecap="round"
                />
              </svg>

              <div className="h-2 w-24 bg-slate-100 rounded-full" />
            </div>

            {/* Stylus / Fountain Pen indicator */}
            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md shadow-violet-500/30 flex items-center justify-center text-white text-lg rotate-12">
              🖋️
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>sample_01.png</span>
              <span className="text-violet-600 font-semibold font-sans">Learned Style</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
