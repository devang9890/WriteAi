import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ToastNotification({
  isOpen,
  title = 'Action Required',
  message,
  onClose,
  duration = 5000,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [isOpen, message, duration, onClose]);

  if (!isOpen || !message) return null;

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-amber-200/90 p-4 flex items-start gap-3.5 text-slate-800">
        {/* Warning Icon Badge */}
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold shrink-0 border border-amber-200 shadow-xs">
          ⚠️
        </div>

        {/* Content */}
        <div className="flex-1 pr-2">
          <h4 className="text-sm font-bold text-slate-900 tracking-tight">
            {title}
          </h4>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed font-normal">
            {message}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
        >
          <span className="text-lg leading-none font-bold">&times;</span>
        </button>
      </div>
    </div>,
    document.body
  );
}
