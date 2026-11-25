import React, { useState } from 'react';

/**
 * OutputPreview Component
 * Step 8: Generated Notes Preview & Export
 *
 * Displays rendered high-resolution handwritten A4 pages.
 * Features:
 * - Multi-page navigation (Previous / Next / Page Jump)
 * - Page thumbnail selector
 * - Zoom & inspection modal
 * - Direct high-res PNG download
 * - Renderer notice & personalization status
 */
export default function OutputPreview({
  generationData,
  generatedPages = [],
  isLoading = false,
}) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const pages = Array.isArray(generatedPages) && generatedPages.length > 0
    ? generatedPages
    : generationData?.pages || [];

  const hasPages = pages.length > 0;
  const activePage = hasPages ? pages[Math.min(currentPageIndex, pages.length - 1)] : null;
  const totalPages = pages.length;

  const handleDownloadCurrentPage = () => {
    if (!activePage?.image_data) return;
    const link = document.createElement('a');
    link.href = activePage.image_data;
    link.download = `WriteAI_Handwritten_Page_${activePage.page_number || currentPageIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllPages = () => {
    if (!hasPages) return;
    pages.forEach((page, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = page.image_data;
        link.download = `WriteAI_Handwritten_Page_${page.page_number || idx + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, idx * 250);
    });
  };

  const handleDownloadPDF = () => {
    if (!hasPages) return;
    const sessionId = generationData?.session_id;
    if (sessionId) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const url = `${apiUrl}/api/generate/pdf/${sessionId}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `WriteAI_Handwritten_${sessionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200/60">
              Output
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Generated Handwritten Notes
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Preview high-resolution personalized handwritten pages ready for export or submission.
          </p>
        </div>

        {/* Download Buttons (Disabled when no generated pages exist) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!hasPages || isLoading}
            onClick={handleDownloadCurrentPage}
            title={hasPages ? 'Download active page as PNG' : 'Download PNG (Disabled: No pages generated yet)'}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 enabled:bg-white enabled:hover:bg-slate-50 enabled:text-slate-700 enabled:border-slate-300 enabled:shadow-xs cursor-pointer"
          >
            <span>🖼️</span>
            <span>Download Page {activePage?.page_number || 1} (PNG)</span>
          </button>

          <button
            type="button"
            disabled={!hasPages || isLoading}
            onClick={handleDownloadPDF}
            title={hasPages ? 'Download complete document as multi-page PDF' : 'Download PDF (Disabled: No pages generated yet)'}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 enabled:bg-red-50 enabled:hover:bg-red-100/80 enabled:text-red-700 enabled:border-red-200 enabled:shadow-xs cursor-pointer"
          >
            <span>📄</span>
            <span>Download PDF</span>
          </button>

          {totalPages > 1 && (
            <button
              type="button"
              disabled={!hasPages || isLoading}
              onClick={handleDownloadAllPages}
              title="Download all generated pages as PNGs"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 enabled:bg-violet-50 enabled:hover:bg-violet-100/80 enabled:text-violet-700 enabled:border-violet-200 enabled:shadow-xs cursor-pointer"
            >
              <span>📦</span>
              <span>All {totalPages} Pages (PNG)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!hasPages ? (
        /* Empty State */
        <div className="min-h-[380px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 flex flex-col items-center justify-center text-center">
          <div className="max-w-sm flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400 text-3xl">
              ✍️
            </div>
            <h3 className="text-base font-bold text-slate-700 mt-2">
              No handwritten pages generated yet
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your generated pages will appear here once you click &quot;Generate Handwritten Notes&quot; above.
            </p>
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] text-slate-500 border border-slate-200/80">
              Format: Full-scale A4 PNG (1240 &times; 1754 px) • Ruled or Blank Paper
            </div>
          </div>
        </div>
      ) : (
        /* Generated Pages Viewer */
        <div className="flex flex-col gap-5">
          {/* Status & Renderer Transparency Banner */}
          <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-xl text-xs text-violet-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-600"></span>
              <span className="font-semibold text-slate-800">
                {generationData?.profile_applied
                  ? 'Personalized Style Profile Applied'
                  : 'Standard Baseline Typography Applied'}
              </span>
              <span className="text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 text-[10px] font-bold tracking-wide">
                Method: Experimental Profile-Based Rendering
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">
                Generated {totalPages} A4 page{totalPages > 1 ? 's' : ''} in {generationData?.generation_time_sec ?? 0.5}s
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium shrink-0">
              <span>{activePage?.width} &times; {activePage?.height} px</span>
              <span>•</span>
              <span>{activePage?.word_count} words</span>
              <span>•</span>
              <span>{activePage?.line_count} lines</span>
            </div>
          </div>

          {/* Navigation Bar if multi-page */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPageIndex === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                &larr; Previous Page
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  Page {currentPageIndex + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  {pages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentPageIndex(idx)}
                      className={`w-6 h-6 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        idx === currentPageIndex
                          ? 'bg-violet-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPageIndex === totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Next Page &rarr;
              </button>
            </div>
          )}

          {/* Page Image Display Container */}
          <div className="relative group bg-slate-100/80 rounded-2xl border border-slate-200/90 p-4 sm:p-8 flex justify-center items-center overflow-hidden">
            <div className="relative max-w-full shadow-2xl rounded-sm overflow-hidden bg-white border border-slate-300">
              <img
                src={activePage?.image_data}
                alt={`Generated Handwritten Page ${activePage?.page_number || currentPageIndex + 1}`}
                className="w-full max-w-[800px] h-auto object-contain cursor-zoom-in"
                onClick={() => setIsZoomed(true)}
              />

              {/* Hover overlay hint */}
              <div
                onClick={() => setIsZoomed(true)}
                className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-zoom-in"
              >
                <span className="bg-slate-900/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md backdrop-blur-xs flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                  Click to Zoom Fullscreen
                </span>
              </div>
            </div>
          </div>

          {/* Scientific Disclaimer & Future Roadmap Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-700">Engineering Notice: </strong>
            Rendered using <strong>Experimental profile-based rendering</strong>. Layout, dominant ballpoint ink color, stroke dilation, and line height are parameterized using your Step 7 handwriting measurements. While this closely approximates line geometry and ballpoint pen flow, true idiosyncratic glyph topology requires a trained handwriting synthesis model (e.g. sequence-conditioned GAN or diffusion stroke model).
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Modal */}
      {isZoomed && activePage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-auto rounded-lg shadow-2xl bg-white p-2">
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 transition shadow-md cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={activePage.image_data}
              alt="Zoomed View"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
