import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, BarChart2, Mic, FolderOpen, Clock, Settings,
  Loader2, Upload, Play, CheckCircle2, AlertCircle, FileCode2,
  Video, Trash2, Camera, X, Check, Copy, RefreshCw, Eye, ShieldAlert,
  Zap, Code, FileText, Cpu, EyeOff, LayoutGrid, Award
} from 'lucide-react';
import api from '../utils/api';
import { timeOfDayGreeting } from '../utils/greeting';
import { toErrorMessage } from '../utils/errorMessage';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'go', 'cpp', 'c',
  'csharp', 'php', 'ruby', 'rust', 'kotlin', 'swift', 'sql', 'html', 'css', 'json'
];

const STARTER_PROMPTS = [
  { text: 'Why is my authorization API returning 401?', label: 'Auth Mismatch' },
  { text: 'Find the resource leaks and memory issues in this code.', label: 'Leak Scanner' },
  { text: 'Explain why my React component crashes on hot reloading.', label: 'React Crash' },
  { text: 'Review this script for security risks and SQL injections.', label: 'Vulnerability Audit' },
  { text: 'Optimize this database search query for large data sets.', label: 'Query Performance' }
];

const MirrorCoach = ({ user, handleLogout }) => {
  // Load settings from localStorage
  const compactMode = localStorage.getItem('setting_compact') === 'true';
  const fontSize = Number(localStorage.getItem('setting_font_size') || '13');
  const wordWrap = localStorage.getItem('setting_word_wrap') !== 'false';
  const displayLineNumbers = localStorage.getItem('setting_line_numbers') !== 'false';
  const defaultLangSetting = localStorage.getItem('setting_default_lang') || 'javascript';
  const defaultModeSetting = localStorage.getItem('setting_analysis_mode') || 'deep';

  // State bindings
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState(defaultLangSetting);
  const [request, setRequest] = useState('');
  const [analysisMode, setAnalysisMode] = useState(defaultModeSetting);
  
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', ai: false, database: false });
  
  // Results structures
  const [result, setResult] = useState(null);
  const [originalCode, setOriginalCode] = useState('');
  const [appliedCode, setAppliedCode] = useState(null);
  const [verification, setVerification] = useState(null);

  // Tabs for patch preview
  const [compareTab, setCompareTab] = useState('fix'); // original, fix, side-by-side

  // Document/Inputs Refs
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Multimodal Attachments
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const videoPreviewRef = useRef(null);
  const streamRef = useRef(null);

  // Microphone/Voice Telemetries
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Copy operations indicators
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedExp, setCopiedExp] = useState(false);

  // Query health checks
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

  // Sync Default language if changed in settings
  useEffect(() => {
    setLanguage(defaultLangSetting);
  }, [defaultLangSetting]);

  // Load from URL history search query parameter
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

  // Gutter rendering calculation
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

  // PDF Text Parser upload
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
    setRequest('');
  };

  // Start Camera API
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

  // Stop Camera API
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    streamRef.current = null;
  };

  // Capture Screenshot Frame
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

  const retakeCapture = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Microphone recording
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

  // Execute analysis on backend
  const handleAnalyze = async () => {
    if (!code.trim() && !capturedImage && !pdfFile) {
      setErrorBanner('Provide code, an image, or a technical document to start.');
      return;
    }

    setAnalyzing(true);
    setErrorBanner('');
    setResult(null);
    setOriginalCode(code);
    setAppliedCode(null);
    setVerification(null);

    // Progressive real step indicators
    const steps = [
      'Understanding analysis request...',
      'Inspecting provided source parameters...',
      'Tracing potential control/syntax errors...',
      'Generating optimized code repair patch...',
      'Verifying solution against compiler engine...'
    ];
    let stepIdx = 0;
    setAnalysisStep(steps[0]);
    const timer = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setAnalysisStep(steps[stepIdx]);
      }
    }, 1200);

    try {
      let response;
      if (capturedImage) {
        response = await api.post('/mirror/analyze-image', { image: capturedImage, request });
        setResult({
          problem: 'Visual UI / screenshot analysis diagnostic report.',
          explanation: response.data.analysis,
          fixedCode: code,
          changes: ['Inspected visual terminal/browser parameters.'],
          severity: 'medium',
          verificationNotes: 'Verification skipped on raw image analysis.'
        });
      } else {
        response = await api.post('/mirror/analyze', { code, language, request, mode: analysisMode });
        setResult(response.data);

        // Save to History Local Storage
        const newSession = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          language,
          title: response.data.problem ? response.data.problem.slice(0, 50) : 'Debugging Session',
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

  const handleApplyFix = () => {
    if (!result?.fixedCode) return;
    setAppliedCode(result.fixedCode);
    setCode(result.fixedCode);
    setVerification(null);
  };

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
    } catch (err) {
      const msg = toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Verification failed.');
      setErrorBanner(msg);
      setVerification({ status: 'error', output: msg });
    } finally {
      setVerifying(false);
    }
  };

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

  const handleClear = () => {
    setCode('');
    setRequest('');
    setResult(null);
    setVerification(null);
    setAppliedCode(null);
    setCapturedImage(null);
    setPdfFile(null);
    window.history.pushState({}, '', '/mirror');
  };

  const selectStarter = (promptText) => {
    setRequest(promptText);
    if (!code || code === DEFAULT_CODE) {
      setCode(DEFAULT_CODE);
    }
  };

  const proposedFix = result?.fixedCode;
  const hasFix = Boolean(proposedFix && proposedFix.trim() !== originalCode.trim());
  const isVerified = verification?.status === 'passed';
  const isFixed = Boolean(appliedCode);
  const isOnline = backendHealth.status === 'ok';

  return (
    <div className={`min-h-screen bg-bg-dominant grid grid-cols-1 lg:grid-cols-12 text-text-primary font-sans ${compactMode ? 'text-xs' : ''}`}>
      
      {/* Sidebar Navigation */}
      <aside className="lg:col-span-2 bg-bg-secondary border-r border-border-default flex flex-col justify-between p-6 select-none">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border border-brand-primary flex items-center justify-center bg-panel-default text-brand-primary font-bold text-xs">
              D
            </div>
            <span className="font-bold tracking-wider text-xs font-mono text-brand-primary">DEVMIRROR AI</span>
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
            <a href="/mirror" className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-panel-default border border-border-default text-brand-primary font-bold shadow-sm">
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

      {/* Main split-pane workspace */}
      <main className="lg:col-span-10 p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6 text-left">
          
          {/* Header section with live check */}
          <header className="border-b border-border-default pb-5 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-brand-primary">
                <Sparkles size={28} /> MIRROR AI
              </h1>
              <p className="text-xs text-text-secondary font-mono mt-1">Your intelligent debugging workspace. Understand. Fix. Verify.</p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] px-3 py-1.5 bg-bg-secondary border border-border-default rounded">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-brand-primary animate-pulse' : 'bg-red-500'}`} />
              <span className={isOnline ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>
                {isOnline ? '● AI ONLINE' : '● BACKEND OFFLINE'}
              </span>
            </div>
          </header>

          {/* Backend Error Banner */}
          {!isOnline && backendHealth.status !== 'checking' && (
            <div className="border border-red-500/30 bg-red-950/10 text-red-300 text-xs font-mono px-4 py-3.5 rounded-lg flex items-center gap-3">
              <AlertCircle className="text-red-400 shrink-0" size={18} />
              <div>
                <p className="font-bold">Backend AI Service Offline</p>
                <p className="text-[11px] text-text-muted mt-0.5">Please check your Render environment configurations or verify that API keys are set correctly.</p>
              </div>
            </div>
          )}

          {errorBanner && (
            <div className="border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Smart empty state if result is empty */}
          {!result && !analyzing && !code && !request && (
            <div className="border border-border-default rounded-xl p-8 lg:p-12 text-center bg-panel-default space-y-6">
              <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto text-brand-primary">
                <Sparkles size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold font-mono">How can Mirror help you debug?</h3>
                <p className="text-xs text-text-secondary max-w-lg mx-auto">
                  Provide code parameters, upload technical specs, or dictate console logs. Mirror AI will trace the issue, produce corrections, and run compiler verifications.
                </p>
              </div>

              {/* Starter modes shortcut actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
                <button
                  type="button"
                  onClick={() => setCode(DEFAULT_CODE)}
                  className="flex flex-col items-center justify-center p-4 border border-border-default hover:border-brand-primary/50 bg-bg-secondary/40 rounded-xl transition-all font-mono text-[10px]"
                >
                  <Code size={16} className="text-brand-primary mb-2" />
                  <span>Debug Code</span>
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center p-4 border border-border-default hover:border-brand-primary/50 bg-bg-secondary/40 rounded-xl transition-all font-mono text-[10px]"
                >
                  <Camera size={16} className="text-brand-primary mb-2" />
                  <span>Analyze Screenshot</span>
                </button>
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-4 border border-border-default hover:border-brand-primary/50 bg-bg-secondary/40 rounded-xl transition-all font-mono text-[10px]"
                >
                  <FileText size={16} className="text-brand-primary mb-2" />
                  <span>Analyze PDF</span>
                </button>
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="flex flex-col items-center justify-center p-4 border border-border-default hover:border-brand-primary/50 bg-bg-secondary/40 rounded-xl transition-all font-mono text-[10px]"
                >
                  <Mic size={16} className="text-brand-primary mb-2" />
                  <span>Voice Debug</span>
                </button>
              </div>

              {/* Starter prompts */}
              <div className="max-w-2xl mx-auto pt-4 space-y-2 text-left">
                <h4 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">Try a starter prompt:</h4>
                <div className="flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectStarter(p.text)}
                      className="px-3 py-1.5 border border-border-default hover:border-brand-primary/40 rounded-lg text-[10px] font-mono bg-bg-secondary/20 text-text-secondary hover:text-text-primary transition-all text-left"
                    >
                      💡 {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Core Split workspace layout */}
          {((result || analyzing) || (code || request)) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* LEFT COLUMN: Code / Context attachments */}
              <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
                <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-3 select-none">
                      <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1.5">
                        <Code size={14} /> CODE WORKSPACE
                      </h2>
                      <div className="flex items-center gap-2.5">
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
                          <Upload size={12} /> Upload
                        </button>
                      </div>
                    </div>

                    {/* Code field with gutter line numbers */}
                    <div className="flex bg-bg-secondary border border-border-default rounded-lg font-mono text-xs overflow-hidden leading-relaxed">
                      {displayLineNumbers && (
                        <div className="bg-bg-secondary/40 text-text-muted select-none text-right px-3 py-3.5 border-r border-border-default/50 min-w-[2.8rem] leading-relaxed hidden sm:block">
                          {linesArr.map(n => <div key={n}>{n}</div>)}
                        </div>
                      )}
                      <textarea
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value);
                          setAppliedCode(null);
                        }}
                        spellCheck={false}
                        className={`w-full bg-transparent p-3.5 text-xs leading-relaxed focus:outline-none resize-y min-h-[320px] font-mono ${
                          wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'
                        }`}
                        style={{ fontSize: `${fontSize}px` }}
                        placeholder="Paste your source code parameters here..."
                      />
                    </div>

                    {/* Camera view interface */}
                    {(cameraActive || capturedImage) && (
                      <div className="border border-border-default rounded-lg p-3 bg-bg-secondary space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
                          <span className="flex items-center gap-1"><Video size={12} /> Camera Context Capture</span>
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
                              Capture Frame
                            </button>
                          </div>
                        )}

                        {capturedImage && (
                          <div className="relative aspect-video w-full bg-black rounded overflow-hidden">
                            <img src={capturedImage} alt="Captured snapshot preview" className="w-full h-full object-cover" />
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
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-border-default/60 mt-4 select-none">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3.5 py-2 border border-border-default rounded-md text-[10px] font-mono font-bold hover:border-red-500/30 hover:text-red-400 transition-colors uppercase"
                    >
                      Clear Editor
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
              </div>

              {/* RIGHT COLUMN: Context prompts, smart modes, operations */}
              <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
                <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border-default pb-3 select-none">
                      <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1.5">
                        <FileText size={14} /> CONTEXT REQUEST
                      </h2>
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

                    {/* Mode selection block */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">Analysis Mode</label>
                      <div className="flex flex-wrap gap-1.5 select-none">
                        {[
                          { id: 'quick', label: 'Quick', icon: Zap },
                          { id: 'deep', label: 'Deep', icon: Cpu },
                          { id: 'review', label: 'Review', icon: Code },
                          { id: 'security', label: 'Security', icon: ShieldAlert },
                          { id: 'performance', label: 'Optimizations', icon: Sparkles }
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setAnalysisMode(m.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[10px] font-mono font-bold transition-all ${
                              analysisMode === m.id
                                ? 'border-brand-primary text-brand-primary bg-brand-primary/5'
                                : 'border-border-default hover:border-brand-primary/40 text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            <m.icon size={11} /> {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Request prompt input */}
                    <div className="relative">
                      <textarea
                        value={request}
                        onChange={(e) => setRequest(e.target.value)}
                        className="w-full bg-bg-secondary border border-border-default rounded-lg p-3.5 text-xs font-sans leading-relaxed min-h-[140px] focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                        placeholder="What problem or bug are you trying to solve?"
                      />
                      
                      <button
                        type="button"
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        className={`absolute bottom-3 right-3 p-2 rounded-full border transition-all ${
                          isRecording 
                            ? 'bg-red-500/10 border-red-500 text-red-400 animate-pulse' 
                            : 'bg-bg-secondary border-border-default text-text-secondary hover:text-brand-primary hover:border-brand-primary'
                        }`}
                        title={isRecording ? 'Stop Recording' : 'Voice Input'}
                      >
                        <Mic size={14} />
                      </button>
                    </div>

                    {/* PDF upload display */}
                    {pdfFile && (
                      <div className="flex items-center justify-between bg-bg-secondary border border-border-default rounded p-2.5 text-xs font-mono">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{pdfFile.name}</p>
                          <p className="text-[9px] text-text-muted">{(pdfFile.size / 1024).toFixed(1)} KB | {pdfParsing ? 'Reading PDF...' : 'Context injected'}</p>
                        </div>
                        <button type="button" onClick={removePdf} className="text-text-muted hover:text-red-400 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border-default/60 mt-4">
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
                          <Sparkles size={14} /> Run Workspace Analysis
                        </>
                      )}
                    </button>
                  </div>
                </section>
              </div>

            </div>
          )}

          {/* Results Output Section */}
          {result && (
            <div className="space-y-6 pt-4 text-left">
              
              {/* Header result metadata */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono select-none">
                {hasFix && !isFixed && (
                  <span className="px-2.5 py-1 rounded border border-brand-primary/40 text-brand-primary bg-brand-primary/5 uppercase font-bold">Fix Proposed</span>
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

              {/* Investigation findings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Diagnostics Panel */}
                <Panel title="Engineering Diagnostics">
                  <div className="space-y-4 text-xs font-mono">
                    <div>
                      <h4 className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">Root Cause</h4>
                      <p className="text-text-primary bg-bg-secondary/40 border border-border-default/40 rounded p-2.5 leading-relaxed font-sans">{result.problem || 'No compiler errors or bugs identified.'}</p>
                    </div>
                    {result.explanation && (
                      <div>
                        <h4 className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">Why It Happens & Impact</h4>
                        <p className="text-text-secondary leading-relaxed font-sans">{result.explanation}</p>
                      </div>
                    )}
                    <button
                      onClick={() => copyToClipboard(result.explanation || result.problem, 'exp')}
                      className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-brand-primary pt-2 transition-colors uppercase font-bold"
                    >
                      {copiedExp ? <Check size={12} /> : <Copy size={12} />}
                      {copiedExp ? 'Copied!' : 'Copy Diagnostics'}
                    </button>
                  </div>
                </Panel>

                {/* Changes List */}
                <Panel title="Code Refactoring Audit">
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
                    <p className="text-xs text-text-muted font-mono">No modifications requested.</p>
                  )}
                </Panel>
              </div>

              {/* Before vs After patch compare visual */}
              <section className="bg-panel-default border border-border-default rounded-xl overflow-hidden flex flex-col">
                <header className="px-4 py-2.5 border-b border-border-default bg-bg-secondary/40 select-none flex justify-between items-center flex-wrap gap-3">
                  <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1">
                    <Code size={12} /> Patch Compare Visualizer
                  </h2>
                  <div className="flex gap-1.5 text-[10px] font-mono font-bold">
                    <button
                      onClick={() => setCompareTab('original')}
                      className={`px-3 py-1 border rounded-md transition-all ${
                        compareTab === 'original' ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-border-default text-text-secondary'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setCompareTab('fix')}
                      className={`px-3 py-1 border rounded-md transition-all ${
                        compareTab === 'fix' ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-border-default text-text-secondary'
                      }`}
                    >
                      Proposed Fix
                    </button>
                    <button
                      onClick={() => setCompareTab('side')}
                      className={`px-3 py-1 border rounded-md transition-all hidden md:block ${
                        compareTab === 'side' ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-border-default text-text-secondary'
                      }`}
                    >
                      Side-by-Side Compare
                    </button>
                  </div>
                </header>

                <div className="p-4 flex-1">
                  {compareTab === 'original' && (
                    <pre className="text-xs font-mono text-text-secondary bg-bg-secondary border border-border-default/50 rounded-lg p-3.5 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[350px]">
                      {originalCode || code}
                    </pre>
                  )}

                  {compareTab === 'fix' && (
                    <pre className="text-xs font-mono text-brand-accent bg-bg-secondary border border-border-default/50 rounded-lg p-3.5 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[350px]">
                      {proposedFix || 'No code fixes generated.'}
                    </pre>
                  )}

                  {compareTab === 'side' && (
                    <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                      <div>
                        <div className="text-[9px] text-text-muted mb-1.5 uppercase font-bold tracking-wider">Before</div>
                        <pre className="text-text-secondary bg-bg-secondary border border-border-default/40 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[350px]">
                          {originalCode || code}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[9px] text-brand-accent mb-1.5 uppercase font-bold tracking-wider">After</div>
                        <pre className="text-brand-accent bg-bg-secondary border border-border-default/40 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[350px]">
                          {proposedFix}
                        </pre>
                      </div>
                    </div>
                  )}

                  {proposedFix && (
                    <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border-default/40">
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
                        className="px-4 py-2 border border-border-default rounded-md text-[10px] font-mono font-bold hover:border-brand-primary flex items-center gap-1.5 disabled:opacity-40 transition-colors uppercase ml-auto animate-pulse-fast"
                      >
                        {verifying ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Running Verification...
                          </>
                        ) : (
                          <>
                            <Play size={12} /> Execute Verification
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Execution result details */}
              {(verification || result.verification) && (
                <Panel title="Verification Engine Results">
                  {(() => {
                    const v = verification || result.verification;
                    const isPassed = v?.status === 'passed';
                    return (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                            isPassed ? 'text-green-400 border-green-500/30 bg-green-500/5' : 'text-red-400 border-red-500/30 bg-red-500/5'
                          }`}>
                            Result: {v?.status || 'failed'}
                          </span>
                          {v?.exitCode !== undefined && (
                            <span className="text-[10px] text-text-muted">Exit Code: {v.exitCode}</span>
                          )}
                        </div>
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap bg-bg-secondary border border-border-default rounded-lg p-3.5 overflow-x-auto max-h-[250px] leading-relaxed">
                          {v?.output || 'No compiler messages returned.'}
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

// Reusable Panel component
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
