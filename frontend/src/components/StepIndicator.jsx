import React from 'react';

const STEPS = [
  { id: 1, label: 'Upload', desc: 'Handwriting Samples' },
  { id: 2, label: 'Preprocess', desc: 'CV Cleaning' },
  { id: 3, label: 'Segment', desc: 'Line Detection' },
  { id: 4, label: 'Write', desc: 'Notes / Content' },
  { id: 5, label: 'Generate', desc: 'AI Engine' },
  { id: 6, label: 'Export', desc: 'PNG / PDF' },
];

export default function StepIndicator({ currentStep = 1 }) {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between overflow-x-auto pb-1 sm:pb-0 gap-2 sm:gap-4 scrollbar-none">
        {STEPS.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-3 min-w-max">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-violet-600 text-white shadow-sm'
                      : isActive
                      ? 'bg-violet-100 text-violet-700 border border-violet-300 ring-2 ring-violet-500/20'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isCompleted ? '✓' : step.id}
                </div>
                <div className="flex flex-col">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isActive ? 'text-violet-700' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-slate-400 hidden md:inline">
                    {step.desc}
                  </span>
                </div>
              </div>

              {idx < STEPS.length - 1 && (
                <div className="flex-1 min-w-[20px] max-w-[60px] h-[2px] bg-slate-200 hidden sm:block">
                  <div
                    className={`h-full transition-all duration-300 ${
                      step.id < currentStep ? 'bg-violet-600' : 'bg-transparent'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
