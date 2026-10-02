import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import StepIndicator from '../components/StepIndicator';
import HandwritingUploader from '../components/HandwritingUploader';
import AnalysisCard from '../components/AnalysisCard';
import ContentEditor from '../components/ContentEditor';
import GenerationCard from '../components/GenerationCard';
import OutputPreview from '../components/OutputPreview';
import { checkBackendHealth } from '../services/api';

export default function Dashboard() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [samples, setSamples] = useState([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

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

  // Handle adding new sample images with local blob URLs
  const handleAddSamples = (newFiles) => {
    const formatted = newFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSamples((prev) => [...prev, ...formatted]);
  };

  // Handle removing a single sample and clean up object URL
  const handleRemoveSample = (indexToRemove) => {
    setSamples((prev) => {
      const removed = prev[indexToRemove];
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  // Handle clearing all uploaded sample images
  const handleClearAll = () => {
    samples.forEach((sample) => {
      if (sample.previewUrl) URL.revokeObjectURL(sample.previewUrl);
    });
    setSamples([]);
    setHasAnalyzed(false);
  };

  // Calculate current workflow step for the step indicator
  let currentStep = 1;
  if (samples.length > 0 && !hasAnalyzed) currentStep = 2;
  else if (samples.length > 0 && hasAnalyzed && !notesText.trim()) currentStep = 3;
  else if (samples.length > 0 && hasAnalyzed && notesText.trim() && !hasGenerated) currentStep = 4;
  else if (hasGenerated) currentStep = 5;

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
        />

        {/* Section 2: Analysis Card */}
        <AnalysisCard
          hasSamples={samples.length > 0}
          sampleCount={samples.length}
          onAnalyzed={() => setHasAnalyzed(true)}
        />

        {/* Section 3: Content Editor */}
        <ContentEditor
          text={notesText}
          onChangeText={setNotesText}
        />

        {/* Section 4: Generation Action Card */}
        <GenerationCard
          hasSamples={samples.length > 0}
          hasContent={notesText.trim().length > 0}
          onGenerated={() => setHasGenerated(true)}
        />

        {/* Section 5: Output Preview */}
        <OutputPreview generatedPages={[]} />
      </main>

      <footer className="border-t border-slate-200/80 bg-white/50 py-6 px-4 text-center text-xs text-slate-400">
        WriteAI &copy; {new Date().getFullYear()} — Personalized Handwriting Generation System
      </footer>
    </div>
  );
}
