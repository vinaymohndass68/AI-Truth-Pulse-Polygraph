
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SetupForm } from './components/SetupForm';
import { PolygraphSession } from './components/PolygraphSession';
import { Report } from './components/Report';
import { SubjectProfile, QuestionRecord, SessionPhase } from './types';

const App: React.FC = () => {
  const [phase, setPhase] = useState<SessionPhase>(SessionPhase.SETUP);
  const [profile, setProfile] = useState<SubjectProfile | null>(null);
  const [records, setRecords] = useState<QuestionRecord[]>([]);

  const handleSetupComplete = (p: SubjectProfile) => {
    setProfile(p);
    setPhase(SessionPhase.READY);
  };

  const startTest = () => {
    setPhase(SessionPhase.TESTING);
  };

  const handleSessionComplete = (finalRecords: QuestionRecord[]) => {
    setRecords(finalRecords);
    setPhase(SessionPhase.REPORT);
  };

  const reset = () => {
    setPhase(SessionPhase.SETUP);
    setProfile(null);
    setRecords([]);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center bg-[#0a0a0c] selection:bg-blue-500/30">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 mb-2">
          TRUTH-PULSE AI
        </h1>
        <div className="h-1 w-24 bg-blue-600 mx-auto rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)]"></div>
      </header>

      <main className="w-full max-w-6xl">
        {phase === SessionPhase.SETUP && (
          <SetupForm onComplete={handleSetupComplete} />
        )}

        {phase === SessionPhase.READY && profile && (
          <div className="max-w-xl mx-auto glass-panel p-8 rounded-3xl text-center border border-blue-500/20">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-shield-halved text-4xl text-blue-500"></i>
            </div>
            <h2 className="text-2xl font-bold mb-4">Subject Ready: {profile.name}</h2>
            <div className="text-slate-400 mb-8 space-y-2 text-sm text-left bg-black/40 p-4 rounded-xl border border-white/5">
              <p>• Biometric sensors active (Camera/Mic)</p>
              <p>• LLM Polygraph engine initialized</p>
              <p>• Contextual behavioral analysis enabled</p>
              <p>• Neural truth-mapping calibrated</p>
            </div>
            <button
              onClick={startTest}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3"
            >
              <i className="fas fa-play"></i>
              START INTERROGATION
            </button>
            <button onClick={reset} className="mt-4 text-slate-500 hover:text-slate-300 text-sm">Cancel and start over</button>
          </div>
        )}

        {phase === SessionPhase.TESTING && profile && (
          <PolygraphSession profile={profile} onSessionComplete={handleSessionComplete} />
        )}

        {phase === SessionPhase.REPORT && profile && (
          <Report profile={profile} records={records} onRestart={reset} />
        )}
      </main>

      <footer className="mt-12 text-slate-600 text-[10px] uppercase tracking-[0.2em] font-mono">
        &copy; 2025 AI TRUTH-PULSE SYSTEMS | CRYPTO-SECURE ANALYSIS
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
