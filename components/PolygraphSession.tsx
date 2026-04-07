
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SubjectProfile, QuestionRecord } from '../types';
import { encode, decode, decodeAudioData } from '../services/audioUtils';

interface PolygraphSessionProps {
  profile: SubjectProfile;
  onSessionComplete: (records: QuestionRecord[]) => void;
}

const FRAME_RATE = 1; 
const JPEG_QUALITY = 0.4;

export const PolygraphSession: React.FC<PolygraphSessionProps> = ({ profile, onSessionComplete }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initializing systems...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastVerdict, setLastVerdict] = useState<'TRUTH' | 'LIE' | null>(null);
  const [stats, setStats] = useState({ 
    total: 0, 
    truths: 0, 
    lies: 0, 
    tremor: 0,
    pitch: 50,
    cadence: 50 
  });
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [records, setRecords] = useState<QuestionRecord[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  
  const currentOutputTranscriptionRef = useRef<string>('');
  const currentInputTranscriptionRef = useRef<string>('');
  const processedVerdictInTurnRef = useRef<boolean>(false);
  const frameIntervalRef = useRef<number | null>(null);

  const cleanup = async () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }

    sourcesRef.current.forEach(s => { 
      try { s.stop(); } catch (e) {} 
    });
    sourcesRef.current.clear();

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { await audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      try { await outputAudioContextRef.current.close(); } catch (e) {}
      outputAudioContextRef.current = null;
    }
  };

  const stopSession = async () => {
    await cleanup();
    onSessionComplete(records);
  };

  useEffect(() => {
    let active = true;

    const startSession = async () => {
      try {
        setErrorMessage(null);
        setIsConnecting(true);
        setStatusMessage("Accessing camera & microphone...");

        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: { width: 640, height: 480 } 
        });
        
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        setStatusMessage("Calibrating audio channels...");
        const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        await inCtx.resume();
        await outCtx.resume();
        
        audioContextRef.current = inCtx;
        outputAudioContextRef.current = outCtx;

        setStatusMessage("Linking with Truth Engine...");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            },
            systemInstruction: `
              You are an ultra-high-speed AI Polygraph. You are direct, analytical, and slightly clinical.
              
              CONTEXT: ${profile.context}
              SUBJECT: ${profile.name}, ${profile.age}, ${profile.sex}.
              
              RESPONSE RULES:
              1. NO FLUFF. NO POLITE CHATTER.
              2. DO NOT START SPEAKING UNTIL THE USER HAS FINISHED THEIR TURN.
              3. EVERY RESPONSE MUST BEGIN WITH: "VERDICT: [TRUTH or LIE] | TREMOR: [0-100] | PITCH: [0-100] | CADENCE: [0-100]"
              4. Follow immediately with 1-2 sharp analytical sentences and a direct follow-up question.
              5. FIRST ACTION: Introduce yourself (1 sentence) and ask the first investigative question based on the context.
            `
          },
          callbacks: {
            onopen: () => {
              if (!active) return;
              setIsConnecting(false);
              setStatusMessage("Online");
              
              sessionPromise.then(s => { 
                sessionRef.current = s;
                // Kickstart the model to speak first
                s.sendRealtimeInput({ text: "System ready. Subject in position. Initiate probe." });
              });

              const source = inCtx.createMediaStreamSource(stream);
              const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                if (!sessionRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                sessionRef.current.sendRealtimeInput({ 
                  media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } 
                });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inCtx.destination);

              frameIntervalRef.current = window.setInterval(() => {
                if (videoRef.current && canvasRef.current && sessionRef.current && active) {
                  const ctx = canvasRef.current.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
                    const base64Data = canvasRef.current.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
                    sessionRef.current.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                  }
                }
              }, 1000 / FRAME_RATE);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!active) return;

              if (message.serverContent?.outputTranscription) {
                setIsProcessing(false);
                const newText = message.serverContent.outputTranscription.text;
                currentOutputTranscriptionRef.current += newText;
                
                const fullText = currentOutputTranscriptionRef.current.toUpperCase();
                
                if (!processedVerdictInTurnRef.current) {
                  // Faster regex matching
                  const verdictMatch = fullText.match(/VERDICT:\s*(TRUTH|LIE)/i);
                  if (verdictMatch) {
                    const verdict = verdictMatch[1].toUpperCase() as 'TRUTH' | 'LIE';
                    processedVerdictInTurnRef.current = true;
                    setLastVerdict(verdict);
                    
                    const tremor = parseInt(fullText.match(/TREMOR:\s*(\d+)/)?.[1] || '50', 10);
                    const pitch = parseInt(fullText.match(/PITCH:\s*(\d+)/)?.[1] || '50', 10);
                    const cadence = parseInt(fullText.match(/CADENCE:\s*(\d+)/)?.[1] || '50', 10);

                    setStats(prev => ({
                      total: prev.total + 1,
                      truths: prev.truths + (verdict === 'TRUTH' ? 1 : 0),
                      lies: prev.lies + (verdict === 'LIE' ? 1 : 0),
                      tremor, pitch, cadence
                    }));
                  }
                }

                const cleanMsg = currentOutputTranscriptionRef.current
                  .replace(/VERDICT:.*?(CADENCE:\s*\d+|$)/gi, '')
                  .trim();
                setCurrentQuestion(cleanMsg);
              }

              if (message.serverContent?.inputTranscription) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                setIsProcessing(true); 
              }

              if (message.serverContent?.turnComplete) {
                const finalTranscript = currentOutputTranscriptionRef.current;
                const finalInput = currentInputTranscriptionRef.current;
                
                if (processedVerdictInTurnRef.current) {
                  const verdict = finalTranscript.toUpperCase().includes('TRUTH') ? 'TRUTH' : 'LIE';
                  setRecords(prev => [...prev, {
                    id: crypto.randomUUID(),
                    question: currentQuestion || "Neural Pulse Probe",
                    answer: finalInput || "(Audio recorded)",
                    verdict: verdict as any,
                    timestamp: Date.now()
                  }]);
                }

                currentOutputTranscriptionRef.current = '';
                currentInputTranscriptionRef.current = '';
                processedVerdictInTurnRef.current = false;
                setIsProcessing(false);
              }

              const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (audioData && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsProcessing(false);
              }
            },
            onerror: (e) => setErrorMessage(e.message || "Uplink Error"),
            onclose: () => {
              if (active) setIsConnecting(true);
            }
          }
        });
      } catch (err: any) {
        setErrorMessage(err.message || "Hardware Access Denied.");
      }
    };

    startSession();
    return () => {
      active = false;
      cleanup();
    };
  }, [profile]);

  if (errorMessage) {
    return (
      <div className="max-w-xl mx-auto glass-panel p-8 rounded-3xl text-center border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
        <i className="fas fa-exclamation-triangle text-5xl text-red-500 mb-6 animate-pulse"></i>
        <h2 className="text-2xl font-bold mb-4 text-white uppercase tracking-tighter">Critical System Error</h2>
        <p className="text-red-400 mb-8 font-mono text-sm p-4 bg-red-950/20 rounded-xl border border-red-500/20">{errorMessage}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-500 font-bold py-4 rounded-xl border border-red-500/30 transition-all uppercase tracking-widest"
        >
          Reboot Neural Link
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Biometric Stream</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
                <span className="text-[10px] text-green-500 font-bold uppercase">Live</span>
              </div>
            </div>
            
            <div className="space-y-5">
              <StatBar label="Vocal Tremor" value={stats.tremor} color="blue" warning={stats.tremor > 70} />
              <StatBar label="Pitch Flux" value={stats.pitch} color="indigo" warning={stats.pitch > 70} />
              <StatBar label="Cadence Shift" value={stats.cadence} color="purple" warning={stats.cadence > 70} />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 text-center">
            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6">Real-time Verdict</h3>
            <div className="flex justify-center gap-10 mb-4">
              <div className={`transition-all duration-300 w-16 h-16 rounded-full flex items-center justify-center border-2 ${lastVerdict === 'TRUTH' ? 'bg-green-500/20 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-slate-900/50 border-white/10 opacity-20'}`}>
                <i className={`fas fa-check text-2xl ${lastVerdict === 'TRUTH' ? 'text-green-500' : 'text-slate-500'}`}></i>
              </div>
              <div className={`transition-all duration-300 w-16 h-16 rounded-full flex items-center justify-center border-2 ${lastVerdict === 'LIE' ? 'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-slate-900/50 border-white/10 opacity-20'}`}>
                <i className={`fas fa-times text-2xl ${lastVerdict === 'LIE' ? 'text-red-500' : 'text-slate-500'}`}></i>
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-500 bg-black/30 py-2 rounded-lg border border-white/5 uppercase tracking-tighter">
              {lastVerdict ? `Analysis Result: ${lastVerdict}` : 'Collecting baseline data...'}
            </div>
          </div>
        </div>

        {/* Center/Right Column: Video and Question */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative glass-panel rounded-3xl overflow-hidden border border-blue-500/30 aspect-video shadow-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className="scanline"></div>
            
            {/* HUD */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
              <div className="bg-red-600/90 px-3 py-1 text-white font-black text-[9px] tracking-widest rounded-sm flex items-center gap-2 shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> SYSTEM MONITORING
              </div>
              <div className="flex flex-col gap-2 items-end">
                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[9px] font-bold text-blue-400 uppercase">
                  Uplink Status: {statusMessage}
                </div>
                {isProcessing && (
                  <div className="bg-blue-600 px-3 py-1.5 rounded-lg text-[9px] font-black text-white animate-pulse flex items-center gap-2 shadow-lg">
                    <i className="fas fa-brain"></i> ENGINE PROCESSING
                  </div>
                )}
              </div>
            </div>

            {isConnecting && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-6">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="text-blue-400 font-mono text-xs tracking-[0.5em] uppercase font-black animate-pulse">{statusMessage}</div>
              </div>
            )}

            {!isConnecting && currentQuestion && (
              <div className="absolute bottom-6 left-6 right-6 p-6 bg-slate-950/90 backdrop-blur-2xl rounded-2xl border border-blue-500/40 shadow-[0_25px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-4 duration-500">
                <div className="text-blue-500 text-[9px] font-black mb-3 uppercase tracking-[0.4em] flex items-center gap-2">
                  <i className="fas fa-robot"></i> Neural Analysis Sequence
                </div>
                <div className="text-white text-xl font-light leading-relaxed italic tracking-tight">
                  "{currentQuestion}"
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center bg-black/40 backdrop-blur-md p-5 rounded-2xl border border-white/5">
             <div className="flex gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Truths</span>
                  <span className="text-2xl font-bold text-green-500 leading-none">{stats.truths}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Lies</span>
                  <span className="text-2xl font-bold text-red-500 leading-none">{stats.lies}</span>
                </div>
             </div>
             <button
                onClick={stopSession}
                className="px-10 py-3 bg-red-600/10 hover:bg-red-600/30 text-red-500 text-xs font-black rounded-xl transition-all uppercase tracking-[0.2em] border border-red-500/20 group"
              >
                <i className="fas fa-stop-circle mr-2 group-hover:scale-110 transition-transform"></i>
                Terminate
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBar = ({ label, value, color, warning }: { label: string, value: number, color: string, warning?: boolean }) => (
  <div className="bg-black/30 p-4 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
    <div className="flex justify-between text-[9px] uppercase font-black tracking-widest mb-2">
      <span className="text-slate-500">{label}</span>
      <span className={warning ? 'text-red-500 animate-pulse' : `text-${color}-400`}>{value}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
      <div 
        className={`h-full bg-${color}-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(59,130,246,0.3)]`} 
        style={{ width: `${value}%` }}
      ></div>
    </div>
  </div>
);
