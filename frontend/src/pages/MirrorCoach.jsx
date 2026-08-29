import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Mic, Video, Trash2, Camera, X, Check, Copy, RefreshCw,
  Loader2, Upload, Play, CheckCircle2, AlertCircle, FileCode2,
  Clock, Settings, BarChart2, FolderOpen, Award, FileText, ChevronRight,
  TrendingUp, Volume2, ShieldAlert
} from 'lucide-react';
import api from '../utils/api';
import { toErrorMessage } from '../utils/errorMessage';

const PRACTICE_MODES = [
  { id: 'mock', label: 'Mock Interview', desc: 'Simulate a real job/placement interview round.', diff: 'Medium', dur: 15, qCount: 5 },
  { id: 'presentation', label: 'Presentation Practice', desc: 'Present your slides and evaluate clarity & eye-contact.', diff: 'Medium', dur: 10, qCount: 3 },
  { id: 'viva', label: 'Project Viva', desc: 'Defend your code, databases, and project architecture.', diff: 'Hard', dur: 15, qCount: 5 },
  { id: 'technical', label: 'Technical Interview', desc: 'Deep dive into data structures, algorithms, & concepts.', diff: 'Hard', dur: 20, qCount: 10 },
  { id: 'hr', label: 'HR Interview', desc: 'Practice behavioral, motivational, and HR questions.', diff: 'Easy', dur: 10, qCount: 5 },
  { id: 'resume', label: 'Resume Interview', desc: 'AI extracts resume details and queries your projects.', diff: 'Medium', dur: 15, qCount: 5 },
  { id: 'study', label: 'Study Material Interview', desc: 'Upload notes/PDFs and practice conceptual definitions.', diff: 'Easy', dur: 15, qCount: 5 },
  { id: 'rapid', label: 'Rapid Fire', desc: 'Speed check! Fast conceptual queries with short timers.', diff: 'Hard', dur: 5, qCount: 10 },
  { id: 'stress', label: 'Stress Interview', desc: 'Practice technical pressure, counterexamples, & tough questions.', diff: 'Hard', dur: 15, qCount: 5 },
  { id: 'communication', label: 'Communication Practice', desc: 'Evaluate clarity, pace, pauses, and filler words.', diff: 'Medium', dur: 10, qCount: 5 },
  { id: 'placement', label: 'Placement Simulation', desc: 'Full placement round simulation covering mixed areas.', diff: 'Hard', dur: 30, qCount: 15 },
  { id: 'weakness', label: 'Weakness Practice', desc: 'Focus specifically on topics where you scored lower.', diff: 'Medium', dur: 15, qCount: 5 }
];

const MirrorCoach = ({ user, handleLogout }) => {
  // Navigation states
  const [step, setStep] = useState('home'); // home, prepare, analysis, live, report

  // Configuration options
  const [selectedMode, setSelectedMode] = useState(PRACTICE_MODES[0]);
  const [difficulty, setDifficulty] = useState(() => localStorage.getItem('setting_difficulty') || 'medium');
  const [questionCount, setQuestionCount] = useState(() => Number(localStorage.getItem('setting_question_count') || '5'));
  const [durationLimit, setDurationLimit] = useState(() => Number(localStorage.getItem('setting_duration') || '15'));
  const [followUpEnabled, setFollowUpEnabled] = useState(() => localStorage.getItem('setting_follow_up') !== 'false');

  // Input states
  const [materialText, setMaterialText] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  
  // Content Analysis results
  const [analysisData, setAnalysisData] = useState(null);
  const [analyzingMaterial, setAnalyzingMaterial] = useState(false);

  // Live session states
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dialogs, setDialogs] = useState([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [isFollowUpRound, setIsFollowUpRound] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(900);
  const [activeTimer, setActiveTimer] = useState(null);
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', ai: false, database: false });

  // Camera preview states
  const [cameraActive, setCameraActive] = useState(false);
  const [streamError, setStreamError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Microphone speech transcribers
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Final Report states
  const [report, setReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [weaknessTopics, setWeaknessTopics] = useState([]);

  // File Upload refs
  const fileInputRef = useRef(null);

  // Health queries
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

  // Sync camera preview track lifecycle
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Timer countdown hook for live session
  useEffect(() => {
    if (step === 'live' && secondsRemaining > 0) {
      const timer = setInterval(() => {
        setSecondsRemaining(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (step === 'live' && secondsRemaining === 0) {
      handleEndInterview();
    }
  }, [step, secondsRemaining]);

  // Load from session history selection if parameters present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      const stored = localStorage.getItem('mirror_practice_sessions');
      if (stored) {
        try {
          const sessions = JSON.parse(stored);
          const found = sessions.find(s => s.id === sessionId);
          if (found) {
            setStep('report');
            setSelectedMode(PRACTICE_MODES.find(m => m.id === found.mode) || PRACTICE_MODES[0]);
            setReport(found.report);
            setDialogs(found.dialogs || []);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  // PDF Material handler
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
      setMaterialText(response.data.text);
      setStep('prepare');
    } catch (err) {
      setErrorBanner(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Failed to extract text from PDF.'));
      setPdfFile(null);
    } finally {
      setPdfParsing(false);
    }
  };

  // Analyze prep material text
  const handleAnalyzeMaterial = async () => {
    if (!materialText.trim()) {
      setErrorBanner('Please paste prep material or upload a PDF first.');
      return;
    }

    setAnalyzingMaterial(true);
    setErrorBanner('');

    try {
      const response = await api.post('/mirror/analyze-material', { text: materialText });
      setAnalysisData(response.data);
      setStep('analysis');
    } catch (err) {
      setErrorBanner(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Material analysis failed.'));
    } finally {
      setAnalyzingMaterial(false);
    }
  };

  // Camera start preview
  const startCamera = async () => {
    setCameraActive(true);
    setStreamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraActive(false);
      setStreamError('Camera permission was denied. Please allow camera access in your browser.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    streamRef.current = null;
  };

  // Microphone recording transcribers
  const startVoiceRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition not supported in this browser. Please type your response.');
      return;
    }

    setIsRecording(true);
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const text = event.results[event.results.length - 1][0].transcript;
      setCurrentResponse(prev => `${prev} ${text}`.trim());
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

  // Start simulated session
  const handleStartInterview = async () => {
    setGeneratingQuestions(true);
    setErrorBanner('');
    setStep('live');
    setSecondsRemaining(durationLimit * 60);

    const topics = analysisData?.topics || ['General Interview Concepts', 'Placement Communication'];

    try {
      const response = await api.post('/mirror/generate-questions', {
        topics,
        mode: selectedMode.label,
        difficulty,
        questionCount
      });

      setQuestions(response.data.questions || []);
      setCurrentIndex(0);
      setDialogs([]);
      setCurrentResponse('');
      setIsFollowUpRound(false);
      setFollowUpQuestion('');
      startCamera();
    } catch (err) {
      setErrorBanner(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Failed to generate questions.'));
      setStep('home');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // Submit and evaluate user's answer
  const handleSubmitAnswer = async () => {
    if (!currentResponse.trim()) {
      alert('Please speak or type your answer before submitting.');
      return;
    }

    setEvaluating(true);
    setErrorBanner('');
    stopVoiceRecording();

    const currentQuestion = isFollowUpRound ? followUpQuestion : questions[currentIndex]?.text;

    try {
      const response = await api.post('/mirror/evaluate-response', {
        question: currentQuestion,
        responseText: currentResponse,
        mode: selectedMode.label,
        history: dialogs
      });

      const nextDialog = {
        question: currentQuestion,
        answer: currentResponse,
        score: response.data.score || 0,
        feedback: response.data.feedback || '',
        fillerWords: response.data.fillerWords || [],
        paceIndicator: response.data.paceIndicator || 'Balanced'
      };

      setDialogs(prev => [...prev, nextDialog]);
      setCurrentResponse('');

      // Check if follow-up is recommended and enabled
      if (followUpEnabled && response.data.followUpQuestion && !isFollowUpRound) {
        setIsFollowUpRound(true);
        setFollowUpQuestion(response.data.followUpQuestion);
      } else {
        // Move to the next conceptual question
        setIsFollowUpRound(false);
        setFollowUpQuestion('');
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // Completed all questions, generate final performance report
          await handleEndInterview([...dialogs, nextDialog]);
        }
      }
    } catch (err) {
      setErrorBanner(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Failed to evaluate response.'));
    } finally {
      setEvaluating(false);
    }
  };

  // Complete session and compile performance metrics
  const handleEndInterview = async (finalDialogs = dialogs) => {
    setGeneratingReport(true);
    setStep('report');
    stopCamera();
    stopVoiceRecording();

    try {
      const response = await api.post('/mirror/generate-report', {
        mode: selectedMode.label,
        dialogs: finalDialogs
      });

      setReport(response.data);

      // Save report session to local history
      const newSession = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        mode: selectedMode.id,
        modeLabel: selectedMode.label,
        title: analysisData?.title || 'General Viva/Interview Prep',
        duration: Math.round(((durationLimit * 60) - secondsRemaining) / 60) || 1,
        questionCount: finalDialogs.length,
        overallScore: response.data.overallScore || 0,
        report: response.data,
        dialogs: finalDialogs
      };

      const stored = localStorage.getItem('mirror_practice_sessions');
      const sessions = stored ? JSON.parse(stored) : [];
      sessions.push(newSession);
      localStorage.setItem('mirror_practice_sessions', JSON.stringify(sessions));

      // Extract improvement topics for next practice weaknesses round
      setWeaknessTopics(response.data.improvements || []);
    } catch (err) {
      setErrorBanner(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Failed to generate report.'));
    } finally {
      setGeneratingReport(false);
    }
  };

  // Trigger practice weaknesses round
  const handlePracticeWeaknesses = () => {
    setSelectedMode(PRACTICE_MODES.find(m => m.id === 'weakness'));
    setAnalysisData({
      title: 'Weaknesses Practice Round',
      topics: weaknessTopics,
      technologies: [],
      concepts: [],
      potentialAreas: []
    });
    setStep('analysis');
  };

  const handleClearMaterial = () => {
    setMaterialText('');
    setPdfFile(null);
    setAnalysisData(null);
    setStep('prepare');
  };

  const formattedTime = () => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

      {/* Main interactive area */}
      <main className="lg:col-span-10 p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6 text-left">
          
          {/* Header check */}
          <header className="border-b border-border-default pb-5 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-brand-primary">
                <Sparkles size={28} /> Mirror AI
              </h1>
              <p className="text-xs text-text-secondary font-mono mt-1">Practice like it's real. Improve before it is.</p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] px-3 py-1.5 bg-bg-secondary border border-border-default rounded">
              <span className={`w-2 h-2 rounded-full ${
                !isOnline ? 'bg-red-500' : (backendHealth.ai ? 'bg-brand-primary animate-pulse' : 'bg-yellow-500')
              }`} />
              <span className={
                !isOnline ? 'text-red-400 font-bold' : (backendHealth.ai ? 'text-brand-primary font-bold' : 'text-yellow-400 font-bold')
              }>
                {!isOnline ? '● BACKEND OFFLINE' : (backendHealth.ai ? '● AI ONLINE' : '● AI KEYS OFFLINE')}
              </span>
            </div>
          </header>

          {errorBanner && (
            <div role="alert" className="border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* STEP 1: HOME PANEL */}
          {step === 'home' && (
            <div className="space-y-6">
              <section className="bg-panel-default border border-border-default rounded-xl p-8 text-center space-y-4">
                <h2 className="text-xl font-bold">AI Interview & Presentation Simulator</h2>
                <p className="text-xs text-text-secondary max-w-lg mx-auto">
                  Upload what you're preparing for (a resume, study guide, presentation slides, or project description) and let Mirror AI simulate a live verbal interview round.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('prepare')}
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors shadow-green-glow"
                  >
                    Start Practice Session
                  </button>
                </div>
              </section>

              {/* Modes Cards Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold text-text-muted uppercase tracking-wider">Practice Modes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PRACTICE_MODES.map((mode) => (
                    <div
                      key={mode.id}
                      onClick={() => {
                        setSelectedMode(mode);
                        setStep('prepare');
                      }}
                      className="bg-panel-default border border-border-default hover:border-brand-primary/40 p-4 rounded-xl space-y-2 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-brand-primary">{mode.label}</span>
                        <span className="text-[9px] font-mono text-text-muted border border-border-default px-1.5 py-0.5 rounded">{mode.diff}</span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">{mode.desc}</p>
                      <div className="flex justify-between items-center text-[9px] font-mono text-text-muted pt-1">
                        <span>🕒 {mode.dur} mins</span>
                        <span>Questions: {mode.qCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREPARE MATERIAL SCREEN */}
          {step === 'prepare' && (
            <section className="bg-panel-default border border-border-default rounded-xl p-6 space-y-6">
              <div className="border-b border-border-default pb-3 flex justify-between items-center select-none">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary">Prepare Your {selectedMode.label} Session</h2>
                <button type="button" onClick={() => setStep('home')} className="text-text-muted hover:text-text-primary text-[10px] font-mono uppercase">
                  ← Back to Home
                </button>
              </div>

              {/* Material Dropzone and pasted text area */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* PDF Upload zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-border-default hover:border-brand-primary/50 rounded-xl p-8 flex flex-col items-center justify-center bg-bg-secondary/20 cursor-pointer transition-all"
                  >
                    <input type="file" ref={fileInputRef} onChange={handlePdfUpload} accept=".pdf" className="hidden" />
                    {pdfParsing ? (
                      <Loader2 className="animate-spin text-brand-primary mb-3" size={24} />
                    ) : (
                      <Upload className="text-brand-primary mb-3" size={24} />
                    )}
                    <span className="text-xs font-bold font-mono">
                      {pdfFile ? pdfFile.name : 'Upload PDF (Resume, Study Notes)'}
                    </span>
                    <span className="text-[10px] text-text-muted mt-1">PDF Files up to 10MB</span>
                  </div>

                  {/* Paste Content zone */}
                  <textarea
                    value={materialText}
                    onChange={(e) => setMaterialText(e.target.value)}
                    className="w-full bg-bg-secondary border border-border-default rounded-xl p-4 text-xs focus:outline-none resize-none min-h-[120px]"
                    placeholder="Alternatively, paste your resume details, study materials, or project description here..."
                  />
                </div>

                {/* Configuration details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-bg-secondary/40 border border-border-default p-4 rounded-xl text-xs font-mono">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-text-muted uppercase">Difficulty</span>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-bg-dominant border border-border-default rounded px-2 py-1">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-text-muted uppercase">Questions</span>
                    <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="bg-bg-dominant border border-border-default rounded px-2 py-1">
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="15">15 Questions</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-text-muted uppercase">Duration</span>
                    <select value={durationLimit} onChange={(e) => setDurationLimit(Number(e.target.value))} className="bg-bg-dominant border border-border-default rounded px-2 py-1">
                      <option value="10">10 Mins</option>
                      <option value="15">15 Mins</option>
                      <option value="20">20 Mins</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-text-muted uppercase">Follow-up Qs</span>
                    <select value={followUpEnabled ? 'on' : 'off'} onChange={(e) => setFollowUpEnabled(e.target.value === 'on')} className="bg-bg-dominant border border-border-default rounded px-2 py-1">
                      <option value="on">Enabled</option>
                      <option value="off">Disabled</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  {materialText && (
                    <button type="button" onClick={handleClearMaterial} className="text-xs font-mono text-red-400 uppercase">
                      Clear Material
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAnalyzeMaterial}
                    disabled={analyzingMaterial || !materialText.trim()}
                    className="ml-auto bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider disabled:opacity-40 flex items-center gap-2"
                  >
                    {analyzingMaterial ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Analyzing...
                      </>
                    ) : (
                      <>
                        Analyze Material & Generate →
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 3: CONTENT ANALYSIS SUMMARY */}
          {step === 'analysis' && analysisData && (
            <section className="bg-panel-default border border-border-default rounded-xl p-6 space-y-6">
              <div className="border-b border-border-default pb-3 flex justify-between items-center select-none font-mono">
                <h2 className="text-xs font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1">
                  🔍 CONTENT ANALYSIS DETECTED
                </h2>
                <button type="button" onClick={() => setStep('prepare')} className="text-text-muted hover:text-text-primary text-[10px] uppercase">
                  ← Re-edit Material
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-bold text-text-primary">{analysisData.title || 'Untitled Practice Material'}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 font-mono text-xs">
                  <div className="space-y-2">
                    <h4 className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Detected Topics</h4>
                    <ul className="space-y-1.5">
                      {analysisData.topics?.map((t, idx) => (
                        <li key={idx} className="text-text-secondary flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" /> {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Technologies</h4>
                    <ul className="space-y-1.5">
                      {analysisData.technologies?.map((tech, idx) => (
                        <li key={idx} className="text-text-secondary flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" /> {tech}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Potential Interview Focus</h4>
                    <ul className="space-y-1.5">
                      {analysisData.potentialAreas?.map((area, idx) => (
                        <li key={idx} className="text-text-secondary flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" /> {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-border-default/60">
                  <button
                    type="button"
                    onClick={handleStartInterview}
                    disabled={generatingQuestions}
                    className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors shadow-green-glow flex items-center justify-center gap-2"
                  >
                    {generatingQuestions ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Launching Interview Session...
                      </>
                    ) : (
                      <>
                        Start practice session ({selectedMode.label}) →
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 4: LIVE INTERVIEW SCREEN */}
          {step === 'live' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Panel: Interviewer details and dialogues */}
              <div className="lg:col-span-6 flex flex-col justify-between">
                <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-border-default pb-3 font-mono text-[10px] text-text-muted select-none">
                      <span>{selectedMode.label.toUpperCase()}</span>
                      <span className="font-bold text-brand-primary uppercase">
                        Question {isFollowUpRound ? 'Follow-Up' : `${currentIndex + 1} of ${questions.length}`}
                      </span>
                    </div>

                    {/* Conceptual Question display */}
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Interviewer asks:</p>
                      <h2 className="text-base sm:text-lg font-bold text-text-primary leading-relaxed">
                        {generatingQuestions ? 'Generating practice questions...' : (isFollowUpRound ? followUpQuestion : questions[currentIndex]?.text)}
                      </h2>
                    </div>

                    {/* Evaluations / thinking status indicators */}
                    <div className="flex items-center gap-2.5 font-mono text-[10px] text-brand-primary select-none pt-2">
                      {evaluating ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Evaluating answer and planning follow-up...</span>
                        </>
                      ) : (
                        isRecording ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            <span className="text-red-400">Microphone recording active. Speak clearly...</span>
                          </>
                        ) : (
                          <span>Awaiting response...</span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Previous question feed summary */}
                  {dialogs.length > 0 && (
                    <div className="border-t border-border-default/50 pt-4 mt-4 space-y-3 max-h-[140px] overflow-y-auto font-mono text-[10px] text-text-secondary">
                      <p className="text-text-muted uppercase tracking-wider font-bold">Session Dialogues:</p>
                      {dialogs.map((d, idx) => (
                        <div key={idx} className="space-y-1">
                          <p className="text-brand-primary">Q: {d.question}</p>
                          <p className="text-text-muted">A: {d.answer} (Score: {d.score}/10)</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Panel: webcam preview & response boxes */}
              <div className="lg:col-span-6 flex flex-col justify-between">
                <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4 flex-1 flex flex-col justify-between">
                  
                  {/* Camera frame area */}
                  <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-border-default/50">
                    {cameraActive ? (
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                        <Video size={24} className="text-text-muted mb-2" />
                        <p className="text-xs font-mono text-text-muted">Webcam Preview Disabled</p>
                        {streamError && <p className="text-[10px] text-red-400 mt-1">{streamError}</p>}
                      </div>
                    )}
                    
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 font-mono text-[9px] px-2 py-1 bg-black/60 rounded border border-white/10 select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                      <span className="text-white">LIVE PREVIEW</span>
                    </div>
                  </div>

                  {/* Response Text area (Fallback/Microphone text holder) */}
                  <div className="space-y-2">
                    <label htmlFor="user-response" className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">Your Response</label>
                    <textarea
                      id="user-response"
                      value={currentResponse}
                      onChange={(e) => setCurrentResponse(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-lg p-3 text-xs focus:outline-none min-h-[90px]"
                      placeholder="Type your response here or use microphone dictation..."
                    />
                  </div>

                  {/* Operational controls footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-default/60 select-none font-mono">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        className={`px-3 py-1.5 border rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                          isRecording ? 'border-red-500 text-red-400 bg-red-500/5' : 'border-border-default hover:border-brand-primary'
                        }`}
                      >
                        <Mic size={12} /> {isRecording ? 'Stop' : 'Voice'}
                      </button>
                      <button
                        type="button"
                        onClick={cameraActive ? stopCamera : startCamera}
                        className="px-3 py-1.5 border border-border-default hover:border-brand-primary rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                      >
                        <Video size={12} /> Camera
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary font-mono">{formattedTime()}</span>
                      <button
                        type="button"
                        onClick={() => handleEndInterview()}
                        className="px-3.5 py-1.5 border border-red-500/30 text-red-400 bg-red-950/5 hover:border-red-500 hover:bg-red-950/20 rounded text-[10px] font-bold uppercase"
                      >
                        End Viva
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitAnswer}
                        disabled={evaluating || !currentResponse.trim()}
                        className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-1.5 rounded font-bold text-[10px] uppercase tracking-wider disabled:opacity-40"
                      >
                        Submit Response
                      </button>
                    </div>
                  </div>
                </section>
              </div>

            </div>
          )}

          {/* STEP 5: PERFORMANCE REPORT SCREEN */}
          {step === 'report' && (
            <div className="space-y-6">
              
              {generatingReport ? (
                <div className="border border-border-default rounded-xl p-12 text-center space-y-4 bg-panel-default font-mono text-xs">
                  <Loader2 className="animate-spin text-brand-primary mx-auto" size={32} />
                  <p className="font-bold">Analyzing your responses...</p>
                  <p className="text-text-muted">Mirror AI is compiling score cards and verifying speaking clarities...</p>
                </div>
              ) : (
                report && (
                  <div className="space-y-6">
                    
                    {/* Scores dashboard */}
                    <section className="bg-panel-default border border-border-default rounded-xl p-6 space-y-6">
                      <div className="border-b border-border-default pb-3 flex justify-between items-center select-none font-mono">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1">
                          📊 Practice Performance Scorecard
                        </h2>
                        <button type="button" onClick={() => setStep('home')} className="text-text-muted hover:text-text-primary text-[10px] uppercase">
                          Back to Home
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-mono">
                        <div className="bg-bg-secondary/40 border border-border-default p-4 rounded-xl">
                          <span className="text-[9px] text-text-muted uppercase">Overall Performance</span>
                          <p className="text-2xl font-bold text-brand-primary mt-1">{report.overallScore || 0}%</p>
                        </div>
                        <div className="bg-bg-secondary/40 border border-border-default p-4 rounded-xl">
                          <span className="text-[9px] text-text-muted uppercase">Communication</span>
                          <p className="text-2xl font-bold text-brand-primary mt-1">{report.communicationScore || 0}%</p>
                        </div>
                        <div className="bg-bg-secondary/40 border border-border-default p-4 rounded-xl">
                          <span className="text-[9px] text-text-muted uppercase">Technical Knowledge</span>
                          <p className="text-2xl font-bold text-brand-primary mt-1">{report.technicalScore || 0}%</p>
                        </div>
                        <div className="bg-bg-secondary/40 border border-border-default p-4 rounded-xl">
                          <span className="text-[9px] text-text-muted uppercase">Answer Quality</span>
                          <p className="text-2xl font-bold text-brand-primary mt-1">{report.answerQualityScore || 0}%</p>
                        </div>
                      </div>
                    </section>

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Strengths */}
                      <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
                        <h3 className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">Strengths</h3>
                        <ul className="space-y-2 text-xs text-text-secondary leading-relaxed">
                          {report.strengths?.map((s, idx) => (
                            <li key={idx} className="flex gap-2">
                              <CheckCircle2 size={14} className="text-brand-primary shrink-0 mt-0.5" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      {/* Improvements */}
                      <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
                        <h3 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">Areas to Improve</h3>
                        <ul className="space-y-2 text-xs text-text-secondary leading-relaxed">
                          {report.improvements?.map((imp, idx) => (
                            <li key={idx} className="flex gap-2">
                              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                              <span>{imp}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>

                    {/* Responsible nervousness warnings */}
                    {report.nervousnessIndicators?.length > 0 && (
                      <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                        <h3 className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert size={14} /> Observable Nervousness Indicators
                        </h3>
                        <div className="text-xs text-text-secondary space-y-2 font-sans">
                          <p className="text-text-muted leading-relaxed">
                            Observable behaviors detected during response analysis that frequently correlate with speaker nervousness. Note: These are observations only, not medical diagnostics:
                          </p>
                          <ul className="space-y-1.5 list-disc pl-4 font-mono text-[11px] leading-relaxed">
                            {report.nervousnessIndicators.map((n, idx) => (
                              <li key={idx}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      </section>
                    )}

                    {/* Question by question audit */}
                    {report.questionReviews?.length > 0 && (
                      <section className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4 text-xs">
                        <h3 className="text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">Question Review</h3>
                        
                        <div className="space-y-4">
                          {report.questionReviews.map((rev, idx) => (
                            <div key={idx} className="border-b border-border-default/50 pb-4 space-y-2 last:border-0 last:pb-0">
                              <div className="flex justify-between items-start gap-3">
                                <p className="font-bold text-text-primary text-[13px]">{rev.question}</p>
                                <span className="text-[10px] font-mono text-brand-primary border border-brand-primary/30 bg-brand-primary/5 px-2 py-0.5 rounded">
                                  Score: {rev.score}/10
                                </span>
                              </div>
                              <p className="text-text-muted italic">" {rev.answer} "</p>
                              <div className="bg-bg-secondary/40 border border-border-default p-3 rounded-lg leading-relaxed space-y-2 font-sans">
                                <p><strong>Evaluation</strong>: {rev.evaluation}</p>
                                <p className="text-brand-accent"><strong>Better Answer Guide</strong>: {rev.betterAnswer}</p>
                                <p className="text-text-muted text-[11px]"><strong>Recommendation</strong>: {rev.followUpRecommend}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Actions controls */}
                    <div className="flex justify-between items-center select-none font-mono">
                      <button
                        type="button"
                        onClick={() => setStep('home')}
                        className="px-4 py-2 border border-border-default hover:border-brand-primary rounded text-xs font-bold uppercase transition-colors"
                      >
                        Back to dashboard
                      </button>

                      <div className="flex items-center gap-2">
                        {weaknessTopics.length > 0 && (
                          <button
                            type="button"
                            onClick={handlePracticeWeaknesses}
                            className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-2 rounded text-xs font-bold uppercase transition-colors shadow-green-glow"
                          >
                            Practice Weaknesses
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleStartInterview}
                          className="px-4 py-2 border border-border-default hover:border-brand-primary rounded text-xs font-bold uppercase transition-colors"
                        >
                          Practice Again
                        </button>
                      </div>
                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default MirrorCoach;
