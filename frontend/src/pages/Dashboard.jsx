import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import StepIndicator from '../components/StepIndicator';
import HandwritingUploader from '../components/HandwritingUploader';
import AnalysisCard from '../components/AnalysisCard';
import ContentEditor from '../components/ContentEditor';
import SegmentationViewer from '../components/SegmentationViewer';
import GenerationCard from '../components/GenerationCard';
import OutputPreview from '../components/OutputPreview';
import { checkBackendHealth, processHandwritingSamples } from '../services/api';

export default function Dashboard() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [samples, setSamples] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [processedSamples, setProcessedSamples] = useState([]);
  const [segmentationResult, setSegmentationResult] = useState(null);
  const [notesText, setNotesText] = useState('');

  // Periodic health check for backend connection status
  useEffect(() => {
    let isMounted = true;
    async function verifyHealth() {
      const isOnline = await checkBackendHealth();
      if (isMounted) setBackendConnected(isOnline);
    }

    verifyHealth();
    const interval = setInterval(verifyHealth, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handle adding new sample images with dimensions and local blob URLs
  const handleAddSamples = (newFiles) => {
    // Reset previous error when new files are added
    setProcessingError(null);

    const formatted = newFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      const sampleItem = {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        file,
        previewUrl,
        dimensions: null,
      };

      // Read dimensions asynchronously
      const img = new Image();
      img.onload = () => {
        setSamples((current) =>
          current.map((item) =>
            item.id === sampleItem.id
              ? { ...item, dimensions: { width: img.naturalWidth, height: img.naturalHeight } }
              : item
          )
        );
      };
      img.src = previewUrl;

      return sampleItem;
    });

    setSamples((prev) => [...prev, ...formatted]);
  };

  // Handle removing a single sample and clean up object URL
  const handleRemoveSample = (indexToRemove) => {
    const removed = samples[indexToRemove];
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    const updated = samples.filter((_, idx) => idx !== indexToRemove);
    setSamples(updated);

    // Remove from processed samples as well if present
    if (removed) {
      setProcessedSamples((prev) => prev.filter((p) => p.filename !== removed.name));
    }
  };

  // Handle clearing all uploaded sample images
  const handleClearAll = () => {
    samples.forEach((sample) => {
      if (sample.previewUrl) URL.revokeObjectURL(sample.previewUrl);
    });
    setSamples([]);
    setProcessedSamples([]);
    setSegmentationResult(null);
    setProcessingError(null);
  };

  // Trigger Step 2 computer-vision preprocessing pipeline via FastAPI
  const handleProcessSamples = async () => {
    if (samples.length === 0) return;

    setIsProcessing(true);
    setProcessingError(null);

    try {
      const filesToUpload = samples.map((s) => s.file);
      const response = await processHandwritingSamples(filesToUpload);

      if (response.success && response.samples) {
        // Pair processed items with corresponding local original preview URLs
        const enriched = response.samples.map((item) => {
          const matched = samples.find((s) => s.name === item.filename);
          return {
            ...item,
            originalPreviewUrl: matched ? matched.previewUrl : '',
          };
        });
        setProcessedSamples(enriched);
      } else {
        throw new Error('Preprocessing succeeded but no sample data was returned.');
      }
    } catch (err) {
      setProcessingError(err.message || 'Failed to process handwriting samples.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate current workflow step for the step indicator
  const hasProcessed = processedSamples.length > 0;
  const hasSegmented = !!segmentationResult && segmentationResult.success;
  let currentStep = 1;
  if (samples.length > 0 && !hasProcessed) currentStep = 2;
  else if (samples.length > 0 && hasProcessed && !hasSegmented) currentStep = 3;
  else if (samples.length > 0 && hasProcessed && hasSegmented && !notesText.trim()) currentStep = 4;
  else if (samples.length > 0 && hasProcessed && hasSegmented && notesText.trim()) currentStep = 5;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans selection:bg-violet-100 selection:text-violet-900">
      <Header backendConnected={backendConnected} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 flex-1 flex flex-col gap-8">
        {/* Hero Section */}
        <Hero />

        {/* Pipeline Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Section 1: Upload Samples */}
        <HandwritingUploader
          samples={samples}
          onAddSamples={handleAddSamples}
          onRemoveSample={handleRemoveSample}
          onClearAll={handleClearAll}
          isProcessing={isProcessing}
        />

        {/* Section 2: Analysis & Preprocessing Card */}
        <AnalysisCard
          hasSamples={samples.length > 0}
          sampleCount={samples.length}
          onProcessSamples={handleProcessSamples}
          isProcessing={isProcessing}
          processedSamples={processedSamples}
          processingError={processingError}
          onClearError={() => setProcessingError(null)}
        />

        {/* Section 3: Line Segmentation Viewer */}
        <SegmentationViewer
          samples={samples}
          onSegmentationComplete={setSegmentationResult}
        />

        {/* Section 4: Content Editor */}
        <ContentEditor
          text={notesText}
          onChangeText={setNotesText}
        />

        {/* Section 5: Generation Action Card */}
        <GenerationCard
          hasSamples={samples.length > 0}
          hasContent={notesText.trim().length > 0}
        />

        {/* Section 6: Output Preview */}
        <OutputPreview generatedPages={[]} />
      </main>

      <footer className="border-t border-slate-200/80 bg-white/50 py-6 px-4 text-center text-xs text-slate-400">
        WriteAI &copy; {new Date().getFullYear()} — Personalized Handwriting Generation System
      </footer>
    </div>
  );
}
