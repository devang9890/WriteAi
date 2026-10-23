import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import StepIndicator from '../components/StepIndicator';
import HandwritingUploader from '../components/HandwritingUploader';
import AnalysisCard from '../components/AnalysisCard';
import ContentEditor from '../components/ContentEditor';
import SegmentationViewer from '../components/SegmentationViewer';
import OCRResults from '../components/OCRResults';
import StyleAnalysisCard from '../components/StyleAnalysisCard';
import StyleEncoderCard from '../components/StyleEncoderCard';
import GenerationCard from '../components/GenerationCard';
import OutputPreview from '../components/OutputPreview';
import {
  checkBackendHealth,
  processHandwritingSamples,
  recognizeHandwriting,
  analyzeHandwritingStyle,
  extractStyleEmbedding,
} from '../services/api';

export default function Dashboard() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [samples, setSamples] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [processedSamples, setProcessedSamples] = useState([]);
  const [segmentationResult, setSegmentationResult] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const [styleData, setStyleData] = useState(null);
  const [isStyleLoading, setIsStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState(null);
  const [encoderData, setEncoderData] = useState(null);
  const [isEncoderLoading, setIsEncoderLoading] = useState(false);
  const [encoderError, setEncoderError] = useState(null);
  const [notesText, setNotesText] = useState('');

  // Keep a ref to busy state so health check interval doesn't falsely mark disconnected
  const isBusyRef = useRef(false);
  useEffect(() => {
    isBusyRef.current = isOcrLoading || isStyleLoading || isEncoderLoading;
  }, [isOcrLoading, isStyleLoading, isEncoderLoading]);

  // Periodic health check for backend connection status
  // Decoupled from heavy CV/OCR/CNN workloads: during active processing, backend is actively working
  useEffect(() => {
    let isMounted = true;
    let consecutiveFailures = 0;

    async function verifyHealth() {
      // If inference, style analysis, or CNN extraction is in-flight, the server is busy handling the workload;
      // do not disconnect due to GIL contention or temporary health check latency.
      if (isBusyRef.current) {
        if (isMounted) setBackendConnected(true);
        consecutiveFailures = 0;
        return;
      }

      const isOnline = await checkBackendHealth();
      if (!isMounted) return;

      if (isOnline) {
        consecutiveFailures = 0;
        setBackendConnected(true);
      } else {
        consecutiveFailures += 1;
        // Require at least 2 consecutive failed health checks to avoid UI flapping during brief spikes
        if (consecutiveFailures >= 2) {
          setBackendConnected(false);
        }
      }
    }

    verifyHealth();
    const interval = setInterval(verifyHealth, 6000);
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
    setOcrData(null);
    setOcrError(null);
    setStyleData(null);
    setStyleError(null);
    setEncoderData(null);
    setEncoderError(null);
    setProcessingError(null);
  };

  // Trigger Step 4 OCR recognition via TrOCR
  const handleRecognizeHandwriting = async () => {
    if (samples.length === 0 || isOcrLoading) return;

    setIsOcrLoading(true);
    setOcrError(null);

    try {
      const fileToOcr = samples[0].file;
      const response = await recognizeHandwriting(fileToOcr);

      setBackendConnected(true);

      if (response && response.success) {
        setOcrData(response);
        setOcrError(null);
      } else {
        setOcrError(response?.message || 'No handwriting lines could be recognized.');
      }
    } catch (err) {
      const errorMsg = err.message || 'An error occurred while recognizing handwriting.';
      setOcrError(errorMsg);

      if (errorMsg.includes('Backend server is unavailable') || errorMsg.includes('ERR_NETWORK')) {
        setBackendConnected(false);
      } else {
        setBackendConnected(true);
      }
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Trigger Step 5 Handwriting Style Analysis
  const handleAnalyzeStyle = async () => {
    if (samples.length === 0 || isStyleLoading) return;

    setIsStyleLoading(true);
    setStyleError(null);

    try {
      const fileToAnalyze = samples[0].file;
      const response = await analyzeHandwritingStyle(fileToAnalyze);

      setBackendConnected(true);

      if (response && response.success) {
        setStyleData(response);
        setStyleError(null);
      } else {
        setStyleError(response?.message || 'Handwriting style could not be analyzed.');
      }
    } catch (err) {
      const errorMsg = err.message || 'An error occurred while analyzing handwriting style.';
      setStyleError(errorMsg);

      if (errorMsg.includes('Backend server is unavailable') || errorMsg.includes('ERR_NETWORK')) {
        setBackendConnected(false);
      } else {
        setBackendConnected(true);
      }
    } finally {
      setIsStyleLoading(false);
    }
  };

  // Trigger Step 6 CNN-Based Handwriting Style Encoder
  const handleExtractStyleEmbedding = async () => {
    if (samples.length === 0 || isEncoderLoading) return;

    setIsEncoderLoading(true);
    setEncoderError(null);

    try {
      // Pass all uploaded sample images for multi-page feature pooling
      const filesToAnalyze = samples.map((s) => s.file);
      const response = await extractStyleEmbedding(filesToAnalyze);

      setBackendConnected(true);

      if (response && response.success) {
        setEncoderData(response);
        setEncoderError(null);
      } else {
        setEncoderError(response?.message || 'CNN style embedding could not be extracted.');
      }
    } catch (err) {
      const errorMsg = err.message || 'An error occurred while extracting style embeddings.';
      setEncoderError(errorMsg);

      if (errorMsg.includes('Backend server is unavailable') || errorMsg.includes('ERR_NETWORK')) {
        setBackendConnected(false);
      } else {
        setBackendConnected(true);
      }
    } finally {
      setIsEncoderLoading(false);
    }
  };

  // Trigger Step 2 computer-vision preprocessing pipeline via FastAPI
  const handleProcessSamples = async () => {
    if (samples.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProcessingError(null);

    try {
      const filesToUpload = samples.map((s) => s.file);
      const response = await processHandwritingSamples(filesToUpload);

      setBackendConnected(true);

      if (response.success && response.samples) {
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
      if (err.message?.includes('Backend server is unavailable')) {
        setBackendConnected(false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate current workflow step for the step indicator
  const hasProcessed = processedSamples.length > 0;
  const hasSegmented = !!segmentationResult && segmentationResult.success;
  const hasOcr = !!ocrData && ocrData.success;
  const hasStyle = !!styleData && styleData.success;
  const hasEncoder = !!encoderData && encoderData.success;

  let currentStep = 1;
  if (samples.length > 0 && !hasProcessed) currentStep = 2;
  else if (samples.length > 0 && hasProcessed && !hasSegmented) currentStep = 3;
  else if (samples.length > 0 && hasProcessed && hasSegmented && !hasOcr) currentStep = 4;
  else if (samples.length > 0 && hasProcessed && hasSegmented && hasOcr && !hasStyle) currentStep = 5;
  else if (samples.length > 0 && hasProcessed && hasSegmented && hasOcr && hasStyle && !hasEncoder) currentStep = 6;
  else if (samples.length > 0 && hasProcessed && hasSegmented && hasOcr && hasStyle && hasEncoder && !notesText.trim()) currentStep = 7;
  else if (samples.length > 0 && hasProcessed && hasSegmented && hasOcr && hasStyle && hasEncoder && notesText.trim()) currentStep = 8;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans selection:bg-violet-100 selection:text-violet-900">
      <Header
        backendConnected={backendConnected}
        isBusy={isOcrLoading || isStyleLoading || isEncoderLoading}
        busyMessage={
          isOcrLoading
            ? 'Backend Busy — Processing OCR'
            : isStyleLoading
            ? 'Backend Busy — Analyzing Style'
            : isEncoderLoading
            ? 'Backend Busy — CNN Feature Extraction'
            : ''
        }
      />

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

        {/* Section 4: Handwritten Text Recognition (OCR) */}
        <OCRResults
          ocrData={ocrData}
          isLoading={isOcrLoading}
          error={ocrError}
          onRecognize={handleRecognizeHandwriting}
          canRecognize={samples.length > 0}
          activeSampleFilename={samples[0]?.name || ''}
          lineCount={segmentationResult?.line_count || 0}
          onUseText={(text) => setNotesText(text)}
        />

        {/* Section 5: Handwriting Style Analysis */}
        <StyleAnalysisCard
          hasSamples={samples.length > 0}
          sampleCount={samples.length}
          activeSampleFilename={samples[0]?.name || ''}
          onAnalyzeStyle={handleAnalyzeStyle}
          isLoading={isStyleLoading}
          styleData={styleData}
          error={styleError}
        />

        {/* Section 6: CNN-Based Handwriting Style Encoder */}
        <StyleEncoderCard
          hasSamples={samples.length > 0}
          sampleCount={samples.length}
          onExtractEmbedding={handleExtractStyleEmbedding}
          isLoading={isEncoderLoading}
          encoderData={encoderData}
          error={encoderError}
        />

        {/* Section 7: Content Editor */}
        <ContentEditor
          text={notesText}
          onChangeText={setNotesText}
        />

        {/* Section 8: Generation Action Card */}
        <GenerationCard
          hasSamples={samples.length > 0}
          hasContent={notesText.trim().length > 0}
        />

        {/* Section 9: Output Preview */}
        <OutputPreview generatedPages={[]} />
      </main>

      <footer className="border-t border-slate-200/80 bg-white/50 py-6 px-4 text-center text-xs text-slate-400">
        WriteAI &copy; {new Date().getFullYear()} — Personalized Handwriting Generation System
      </footer>
    </div>
  );
}
