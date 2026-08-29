import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, BarChart2, Mic, FolderOpen, Clock, Settings,
  Loader2, Upload, Play, CheckCircle2, AlertCircle, FileCode2,
  Video, Trash2, Camera, X, Check, Copy, RefreshCw, PlusCircle, HelpCircle
} from 'lucide-react';
import api from '../utils/api';
import { timeOfDayGreeting } from '../utils/greeting';
import { toErrorMessage } from '../utils/errorMessage';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'go', 'cpp', 'c',
  'csharp', 'php', 'ruby', 'rust', 'kotlin', 'swift', 'sql', 'html', 'css', 'json'
];

const DEFAULT_CODE = `function calculateTotal(price, quantity) {
  return price * quantity;
}

const total = calculateTotal(100, "3");

console.log("Total:", total.toFixed(2));`;

const DEFAULT_REQUEST = 'Debug this code. Identify the exact error, explain why it happens, generate the corrected code, and verify the output.';

const MirrorCoach = ({ user, handleLogout }) => {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState('javascript');
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  
  // States for operations
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', ai: false, database: false });
  
  // Results
  const [result, setResult] = useState(null);
  const [originalCode, setOriginalCode] = useState('');
  const [appliedCode, setAppliedCode] = useState(null);
  const [verification, setVerification] = useState(null);

  // File Upload Code
  const fileInputRef = useRef(null);

  // PDF Analysis States
  const pdfInputRef = useRef(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [pdfParsing, setPdfParsing] = useState(false);

  // Camera States
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const videoPreviewRef = useRef(null);
  const streamRef = useRef(null);

  // Microphone/Voice States
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Copy success indicator
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedExp, setCopiedExp] = useState(false);

  // Health check query on mount
  useEffect(() => {
    const checkHealth = () => {
      api.get('/health')
        .then((res) => {
          setBackendHealth({
            status: res.data.status === 'ok' ? 'ok' : 'error',
            ai: res.data.ai,
            database: res.data.database
          });
        })
        .catch(() => {
          setBackendHealth({ status: 'error', ai: false, database: false });
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  // History loader from URL search param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const historyId = params.get('history_id');
    if (historyId) {
      const stored = localStorage.getItem('mirror_history_sessions');
      if (stored) {
        try {
          const sessions = JSON.parse(stored);
          const found = sessions.find(s => s.id === historyId);
          if (found) {
            setCode(found.code);
            setLanguage(found.language);
            setRequest(found.request);
            setResult(found.result);
            setOriginalCode(found.code);
            setVerification(found.verification || null);
          }
        } catch (e) {
          console.error('Error loading session from history:', e);
        }
      }
    }
  }, []);

  // Line numbers helper
  const lineCount = code.split('\n').length || 1;
  const linesArr = Array.from({ length: lineCount }, (_, i) => i + 1);

  // File uploading handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCode(String(ev.target?.result || ''));
      const ext = file.name.split('.').pop()?.toLowerCase();
      const extMap = { js: 'javascript', ts: 'typescript', py: 'python', java: 'java', go: 'go', rs: 'rust' };
      if (ext && extMap[ext]) setLanguage(extMap[ext]);
    };
    reader.readAsText(file);
  };

  // PDF Parser upload handler
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setErrorBanner('Only PDF documents are allowed.');
      return;
    }

    setPdfFile(file);
    setPdfParsing(true);
    setErrorBanner('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/mirror/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPdfText(response.data.text);
      setRequest(prev => `${prev}\n\n[Attached Technical PDF: ${file.name}]\n${response.data.text.slice(0, 1000)}...`);
    } catch (err) {
      setErrorBanner(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Failed to extract text from PDF.'));
      setPdfFile(null);
    } finally {
      setPdfParsing(false);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfText('');
    setRequest(DEFAULT_REQUEST);
  };

  // Start Camera
  const startCamera = async () => {
    setCameraActive(true);
    setCameraError('');
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraActive(false);
      setCameraError('Camera permission was denied. Please allow camera access in your browser.');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    streamRef.current = null;
  };

  // Capture Frame
  const captureFrame = () => {
    if (videoPreviewRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoPreviewRef.current.videoWidth || 640;
      canvas.height = videoPreviewRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoPreviewRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  // Retake Capture
  const retakeCapture = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Voice Inputs (Web Speech API)
  const startVoiceRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition not supported in this browser. Please type your request.');
      return;
    }

    setIsRecording(true);
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setRequest(prev => `${prev} ${text}`.trim());
    };

    recognition.onerror = (e) => {
      console.error(e);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // Analyze with Mirror AI
  const handleAnalyze = async () => {
    if (!code.trim()) {
      setErrorBanner('Paste or upload source code first.');
      return;
    }

    setAnalyzing(true);
    setErrorBanner('');
    setResult(null);
    setOriginalCode(code);
    setAppliedCode(null);
    setVerification(null);

    // Simulated progress transitions
    const steps = [
      'Analyzing code syntax...',
      'Tracing control flow issue...',
      'Generating corrected patch...',
      'Verifying solution against compiler rules...'
    ];
    let stepIdx = 0;
    setAnalysisStep(steps[0]);
    const timer = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setAnalysisStep(steps[stepIdx]);
      }
    }, 1500);

    try {
      let response;
      if (capturedImage) {
        // If image analysis requested
        response = await api.post('/mirror/analyze-image', { image: capturedImage, request });
        setResult({
          problem: 'Webcam screen capture analysis',
          explanation: response.data.analysis,
          fixedCode: code,
          changes: ['Reviewed via image analysis'],
          severity: 'medium'
        });
      } else {
        response = await api.post('/mirror/analyze', { code, language, request });
        setResult(response.data);
        
        // Save to Local History
        const newSession = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          language,
          title: response.data.problem || 'Code Refactoring Session',
          request,
          code,
          result: response.data,
          verification: null
        };
        const stored = localStorage.getItem('mirror_history_sessions');
        const historyArr = stored ? JSON.parse(stored) : [];
        historyArr.push(newSession);
        localStorage.setItem('mirror_history_sessions', JSON.stringify(historyArr));
      }
    } catch (err) {
      const msg = toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Mirror AI analysis failed.');
      setErrorBanner(msg);
    } finally {
      clearInterval(timer);
      setAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Apply Proposed Patch
  const handleApplyFix = () => {
    if (!result?.fixedCode) return;
    setAppliedCode(result.fixedCode);
    setCode(result.fixedCode);
    setVerification(null);
  };

  // Run verification
  const handleVerify = async () => {
    const codeToRun = appliedCode || result?.fixedCode || code;
    if (!codeToRun?.trim()) {
      setErrorBanner('No code available to verify.');
      return;
    }

    setVerifying(true);
    setErrorBanner('');

    try {
      const response = await api.post('/mirror/verify', { code: codeToRun, language });
      setVerification(response.data.verification);

      // Update in history if session active
      const params = new URLSearchParams(window.location.search);
      const historyId = params.get('history_id');
      if (historyId) {
        const stored = localStorage.getItem('mirror_history_sessions');
        if (stored) {
          const historyArr = JSON.parse(stored);
          const idx = historyArr.findIndex(s => s.id === historyId);
          if (idx !== -1) {
            historyArr[idx].verification = response.data.verification;
            localStorage.setItem('mirror_history_sessions', JSON.stringify(historyArr));
          }
        }
      }
    } catch (err) {
      const msg = toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Verification failed.');
      setErrorBanner(msg);
      setVerification({ status: 'error', output: msg });
    } finally {
      setVerifying(false);
    }
  };

  // Utility copy functions
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedExp(true);
      setTimeout(() => setCopiedExp(false), 2000);
    }
  };

  const clearWorkspace = () => {
    setCode('');
    setRequest('');
    setResult(null);
    setVerification(null);
    setAppliedCode(null);
    setCapturedImage(null);
    setPdfFile(null);
    window.history.pushState({}, '', '/mirror'); // Clear search queries
  };

  const isOnline = backendHealth.status === 'ok';

  return (
    <div className="min-h-screen bg-bg-dominant grid grid-cols-1 lg:grid-cols-12 text-text-primary font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="lg:col-span-2 bg-bg-secondary border-r border-border-default flex flex-col justify-between p-6 select-none">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border border-brand-primary flex items-center justify-center bg-panel-default text-brand-primary font-bold text-xs">
              D
            </div>
            <span className="font-bold tracking-wider text-xs font-mono">DEVMIRROR AI</span>
          </div>

          <nav className="flex flex-col gap-1.5 text-xs font-mono text-text-secondary text-left">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mb-2 font-bold">Workspace</div>
            <a href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <BarChart2 size={14} /> Overview
            </a>
            <a href="/debug" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Mic size={14} /> SkillDebug
            </a>
            <a href="/dashboard#history" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <FolderOpen size={14} /> Missions
            </a>
            <a href="/mirror" className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-panel-default border border-border-default text-brand-primary">
              <Sparkles size={14} /> Mirror AI
            </a>
            <a href="/history" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Clock size={14} /> History
            </a>

            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mt-6 mb-2 font-bold">System</div>
            <a href="/settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Settings size={14} /> Settings
            </a>
          </nav>
        </div>

        <div className="space-y-4 pt-6 border-t border-border-default text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-panel-elevated border border-border-default flex items-center justify-center font-bold text-xs text-brand-primary">
              {user?.full_name?.charAt(0) || 'D'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold truncate">{user?.full_name}</p>
              <p className="text-[9px] text-text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-border-default hover:border-red-500/30 bg-panel-default hover:bg-red-950/10 text-xs font-mono text-text-secondary hover:text-red-400 transition-colors"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="lg:col-span-10 p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6 text-left">
          
          {/* Header & Health indicator */}
          <header className="border-b border-border-default pb-5 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="text-brand-primary" size={28} /> Mirror AI
              </h1>
              <p className="text-xs text-text-secondary font-mono mt-1">AI-powered debugging, code analysis and developer assistance.</p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] px-3 py-1.5 bg-bg-secondary border border-border-default rounded">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-brand-primary animate-pulse' : 'bg-red-500'}`} />
              <span className={isOnline ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>
                {isOnline ? 'AI ONLINE' : 'AI OFFLINE'}
              </span>
            </div>
          </header>

          {/* Backend Connection Warnings */}
          {!isOnline && backendHealth.status !== 'checking' && (
            <div role="status" className="border border-red-500/30 bg-red-950/10 text-red-400 text-xs font-mono px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle size={16} />
              <span>AI service temporarily unavailable. Check your backend configuration.</span>
            </div>
          )}

          {errorBanner && (
            <div role="alert" className="border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono px-4 py-3 rounded flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Two-Column Editor Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* LEFT: Code Input panel */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-3">
                <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary">Code Input</h2>
                <div className="flex items-center gap-3">
                  <select
                    id="mirror-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-bg-secondary border border-border-default rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".js,.ts,.py,.java,.go,.rs,.txt,.json,.html,.css,.php,.rb,.c,.cpp,.cs" className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 border border-border-default rounded text-[10px] font-mono hover:border-brand-primary transition-colors"
                  >
                    <Upload size={12} /> Upload File
                  </button>
                </div>
              </div>

              {/* IDE Textarea with gutter */}
              <div className="flex bg-bg-secondary border border-border-default rounded-lg font-mono text-xs overflow-hidden leading-relaxed">
                <div className="bg-bg-secondary/40 text-text-muted select-none text-right px-3 py-3.5 border-r border-border-default/50 min-w-[2.8rem] leading-relaxed hidden sm:block">
                  {linesArr.map(n => <div key={n}>{n}</div>)}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setAppliedCode(null);
                  }}
                  spellCheck={false}
                  className="w-full bg-transparent p-3.5 text-xs leading-relaxed focus:outline-none resize-y min-h-[300px] font-mono"
                  placeholder="Paste your source code here..."
                />
              </div>

              {/* Camera Frame Preview Container */}
              {(cameraActive || capturedImage) && (
                <div className="border border-border-default rounded-lg p-3 bg-bg-secondary space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
                    <span className="flex items-center gap-1"><Video size={12} /> Camera Capture</span>
                    <button type="button" onClick={() => { stopCamera(); setCapturedImage(null); }} className="hover:text-red-400">
                      <X size={14} />
                    </button>
                  </div>

                  {cameraActive && (
                    <div className="relative aspect-video w-full bg-black rounded overflow-hidden">
                      <video ref={videoPreviewRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={captureFrame}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-1.5 rounded-full font-mono text-[10px] font-bold shadow-lg"
                      >
                        Capture Snapshot
                      </button>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="relative aspect-video w-full bg-black rounded overflow-hidden">
                      <img src={capturedImage} alt="Captured preview" className="w-full h-full object-cover" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                        <button
                          type="button"
                          onClick={retakeCapture}
                          className="bg-black/60 hover:bg-black text-white border border-white/20 px-3 py-1 rounded text-[10px] font-mono"
                        >
                          Retake
                        </button>
                        <button
                          type="button"
                          onClick={() => setCapturedImage(null)}
                          className="bg-red-950/80 hover:bg-red-900 border border-red-500/20 text-red-300 px-3 py-1 rounded text-[10px] font-mono"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <p className="text-[10px] font-mono text-red-400">{cameraError}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={clearWorkspace}
                  className="px-3.5 py-2 border border-border-default rounded-md text-[10px] font-mono font-bold hover:border-red-500/30 hover:text-red-400 transition-colors uppercase"
                >
                  Clear Workspace
                </button>
                {!cameraActive && !capturedImage && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-2 border border-border-default rounded-md text-[10px] font-mono font-bold hover:border-brand-primary transition-colors flex items-center gap-1.5 uppercase"
                  >
                    <Camera size={12} /> Add Screen Capture
                  </button>
                )}
              </div>
            </section>

            {/* RIGHT: Debugging Request panel */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-default pb-3">
                  <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary">Debugging Request</h2>
                  <div className="flex items-center gap-2">
                    <input type="file" ref={pdfInputRef} onChange={handlePdfUpload} accept=".pdf" className="hidden" />
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 border border-border-default rounded text-[10px] font-mono hover:border-brand-primary transition-colors"
                    >
                      📎 Attach PDF
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    className="w-full bg-bg-secondary border border-border-default rounded-lg p-3.5 text-xs font-sans leading-relaxed min-h-[180px] focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                    placeholder="Describe the problem or ask Mirror AI what you want to analyze..."
                  />
                  
                  {/* Floating Voice Recording Trigger */}
                  <button
                    type="button"
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={`absolute bottom-3 right-3 p-2 rounded-full transition-all border ${
                      isRecording 
                        ? 'bg-red-500/10 border-red-500 text-red-400 animate-pulse' 
                        : 'bg-bg-secondary border-border-default text-text-secondary hover:text-brand-primary hover:border-brand-primary'
                    }`}
                    title={isRecording ? 'Stop Recording' : 'Voice Input'}
                  >
                    <Mic size={14} />
                  </button>
                </div>

                {/* PDF File State indicator */}
                {pdfFile && (
                  <div className="flex items-center justify-between bg-bg-secondary border border-border-default rounded p-2.5 text-xs font-mono">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{pdfFile.name}</p>
                      <p className="text-[9px] text-text-muted">{(pdfFile.size / 1024).toFixed(1)} KB | {pdfParsing ? 'Extracting text...' : 'Text attached'}</p>
                    </div>
                    <button type="button" onClick={removePdf} className="text-text-muted hover:text-red-400 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border-default/60">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing || !isOnline}
                  className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-green-glow"
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> {analysisStep || 'Analyzing...'}
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Analyze with Mirror AI
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* AI Result Dashboard Panel */}
          {result && (
            <div className="space-y-6 pt-4">
              
              {/* Header indicators */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
                {hasFix && !isFixed && (
                  <span className="px-2.5 py-1 rounded border border-brand-primary/40 text-brand-primary bg-brand-primary/5 uppercase font-bold">Fix proposed</span>
                )}
                {isFixed && (
                  <span className="px-2.5 py-1 rounded border border-brand-primary/40 text-brand-primary bg-brand-primary/5 flex items-center gap-1 uppercase font-bold">
                    <CheckCircle2 size={12} /> Fix Applied
                  </span>
                )}
                {isVerified && (
                  <span className="px-2.5 py-1 rounded border border-green-500/40 text-green-400 bg-green-500/5 flex items-center gap-1 uppercase font-bold">
                    <CheckCircle2 size={12} /> Verified SUCCESS
                  </span>
                )}
                {result.severity && result.severity !== 'none' && (
                  <span className={`px-2.5 py-1 rounded border uppercase font-bold ${
                    result.severity === 'critical' || result.severity === 'high'
                      ? 'text-red-400 border-red-500/30'
                      : 'text-yellow-400 border-yellow-500/30'
                  }`}>
                    Severity: {result.severity}
                  </span>
                )}
              </div>

              {/* Analysis findings cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Findings Details */}
                <Panel title="AI Diagnostics & Explanation">
                  <div className="space-y-4 text-xs">
                    <div>
                      <h4 className="text-[10px] font-mono text-text-muted uppercase mb-1">Root Cause</h4>
                      <p className="text-text-primary leading-relaxed font-sans">{result.problem || 'No specific bugs identified.'}</p>
                    </div>
                    {result.explanation && (
                      <div>
                        <h4 className="text-[10px] font-mono text-text-muted uppercase mb-1">Why It Happens</h4>
                        <p className="text-text-secondary leading-relaxed font-sans">{result.explanation}</p>
                      </div>
                    )}
                    <button
                      onClick={() => copyToClipboard(result.explanation || result.problem, 'exp')}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted hover:text-brand-primary pt-2 transition-colors"
                    >
                      {copiedExp ? <Check size={12} /> : <Copy size={12} />}
                      {copiedExp ? 'Copied!' : 'Copy Explanation'}
                    </button>
                  </div>
                </Panel>

                {/* Changes List */}
                <Panel title="Proposed Changes">
                  {result.changes?.length > 0 ? (
                    <div className="space-y-3 font-mono text-xs">
                      <ul className="space-y-2">
                        {result.changes.map((change, i) => (
                          <li key={i} className="flex gap-2">
                            <FileCode2 size={14} className="text-brand-primary shrink-0 mt-0.5" />
                            <span className="text-text-secondary">{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted font-mono">No modifications necessary.</p>
                  )}
                </Panel>
              </div>

              {/* Code comparison panel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Panel title="Original Code">
                  <pre className="text-xs font-mono text-text-secondary bg-bg-secondary border border-border-default/50 rounded-lg p-3.5 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[350px]">
                    {originalCode || code}
                  </pre>
                </Panel>

                <Panel title="Corrected Code">
                  {proposedFix ? (
                    <pre className="text-xs font-mono text-brand-accent bg-bg-secondary border border-border-default/50 rounded-lg p-3.5 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[350px]">
                      {proposedFix}
                    </pre>
                  ) : (
                    <div className="p-12 text-center text-xs text-text-muted font-mono bg-bg-secondary border border-border-default/50 rounded-lg">
                      No code patch suggested.
                    </div>
                  )}

                  {proposedFix && (
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={handleApplyFix}
                        disabled={!hasFix || isFixed}
                        className="px-4 py-2 border border-brand-primary text-brand-primary rounded-md text-[10px] font-mono font-bold hover:bg-brand-primary/10 disabled:opacity-40 transition-colors uppercase"
                      >
                        Apply Fix to Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(proposedFix, 'code')}
                        className="px-4 py-2 border border-border-default rounded-md text-[10px] font-mono font-bold hover:border-brand-primary flex items-center gap-1.5 transition-colors uppercase"
                      >
                        {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                        {copiedCode ? 'Copied' : 'Copy Code'}
                      </button>
                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={verifying}
                        className="px-4 py-2 border border-border-default rounded-md text-[10px] font-mono font-bold hover:border-brand-primary flex items-center gap-1.5 disabled:opacity-40 transition-colors uppercase ml-auto"
                      >
                        {verifying ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Verifying...
                          </>
                        ) : (
                          <>
                            <Play size={12} /> Verify Patch
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </Panel>
              </div>

              {/* Verification logs output */}
              {(verification || result.verification) && (
                <Panel title="Verification Test Output">
                  {(() => {
                    const v = verification || result.verification;
                    const isPassed = v?.status === 'passed';
                    return (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                            isPassed ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'
                          }`}>
                            Status: {v?.status || 'failed'}
                          </span>
                          {v?.exitCode !== undefined && (
                            <span className="text-[10px] text-text-muted">Exit Code: {v.exitCode}</span>
                          )}
                        </div>
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap bg-bg-secondary border border-border-default rounded-lg p-3.5 overflow-x-auto max-h-[250px]">
                          {v?.output || 'No verification logs output returned.'}
                        </pre>
                      </div>
                    );
                  })()}
                </Panel>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
};

// Internal reusable panel layout helper
function Panel({ title, children, className = '' }) {
  return (
    <section className={`bg-panel-default border border-border-default rounded-xl overflow-hidden ${className} flex flex-col justify-between`}>
      <header className="px-4 py-2.5 border-b border-border-default bg-bg-secondary/40 select-none">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary">{title}</h2>
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}

export default MirrorCoach;
