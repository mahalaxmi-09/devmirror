import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Camera, Mic, BarChart2, FolderOpen,
  Target, Clock, Settings, Loader2, VideoOff, Upload, Volume2, VolumeX, RotateCcw
} from 'lucide-react';
import api from '../utils/api';
import Waveform from '../components/Waveform';
import { timeOfDayGreeting } from '../utils/greeting';
import { sampleFrameMetrics, deriveVisualMetrics } from '../utils/visualSignals';

const SESSION_MODES = [
  'Practice',
  'Interview',
  'Presentation',
  'Project',
  'Viva',
  'Communication',
  'Custom'
];

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

function parseMaybe(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

const MirrorCoach = ({ user, handleLogout }) => {
  const navigate = useNavigate();
  const [stage, setStage] = useState('setup');
  const stageRef = useRef('setup');
  useEffect(() => { stageRef.current = stage; }, [stage]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);

  const [prepType, setPrepType] = useState('');
  const [sessionMode, setSessionMode] = useState('Practice');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const [dialogHistory, setDialogHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [avaRemark, setAvaRemark] = useState("Let's practice.");
  const [lastFeedback, setLastFeedback] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [userAnswerText, setUserAnswerText] = useState('');
  const [inputMode, setInputMode] = useState('text');
  const [avaStatus, setAvaStatus] = useState('Listening');

  const [useVoice, setUseVoice] = useState(true);
  const [wantCamera, setWantCamera] = useState(false);
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const visualSamplesRef = useRef([]);
  const visualTimerRef = useRef(null);
  const [cameraStatus, setCameraStatus] = useState('CAMERA NOT CONNECTED');
  const [cameraNote, setCameraNote] = useState('');
  const [visualMetrics, setVisualMetrics] = useState(null);

  const recognitionRef = useRef(null);
  const speechBaseRef = useRef('');
  const [micStatus, setMicStatus] = useState('MICROPHONE OFF');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const fileInputRef = useRef(null);

  const [ttsMuted, setTtsMuted] = useState(false);
  const [lastSpoken, setLastSpoken] = useState('');
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return undefined;
    }
    setSpeechSupported(true);
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          speechBaseRef.current = `${speechBaseRef.current} ${piece}`.trim();
        } else {
          interimTranscript += piece;
        }
      }
      const next = `${speechBaseRef.current} ${interimTranscript}`.trim();
      setUserAnswerText(next);
      if (stageRef.current === 'setup') setPrepType(next);
      setInputMode('voice');
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setMicStatus('MICROPHONE OFF');
        setErrorBanner('Microphone access is unavailable. You can type instead.');
      } else if (e.error !== 'aborted') {
        setErrorBanner("Couldn't understand the audio. Please try again or type your response.");
      }
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
      setMicStatus((prev) => (prev === 'LISTENING' ? 'MICROPHONE ACTIVE' : prev));
    };

    recognitionRef.current = rec;
    return () => {
      try { rec.abort(); } catch { /* ignore */ }
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (visualTimerRef.current) {
      clearInterval(visualTimerRef.current);
      visualTimerRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startVisualSampling = useCallback(() => {
    if (visualTimerRef.current) clearInterval(visualTimerRef.current);
    visualSamplesRef.current = [];
    visualTimerRef.current = setInterval(() => {
      if (!canvasRef.current || !videoRef.current) return;
      const sample = sampleFrameMetrics(videoRef.current, canvasRef.current);
      if (!sample) return;
      visualSamplesRef.current = [...visualSamplesRef.current.slice(-24), sample];
      setVisualMetrics(deriveVisualMetrics(visualSamplesRef.current));
    }, 2000);
  }, []);

  const requestCamera = useCallback(async () => {
    setCameraStatus('CAMERA REQUESTED');
    setCameraNote('Camera is used only to provide communication coaching based on visible interaction signals.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStatus('CAMERA ACTIVE');
      setCameraNote('');
      startVisualSampling();
    } catch {
      setCameraStatus('CAMERA DENIED');
      setCameraNote('Camera access is unavailable. Mirror AI will continue without visual coaching.');
      setWantCamera(false);
    }
  }, [startVisualSampling]);

  useEffect(() => {
    if (stage === 'live' && wantCamera) {
      requestCamera();
    }
    if (stage !== 'live') {
      stopCamera();
      if (stage !== 'report') setCameraStatus('CAMERA NOT CONNECTED');
    }
    return () => {};
  }, [stage, wantCamera, requestCamera, stopCamera]);

  useEffect(() => () => {
    stopCamera();
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [stopCamera, ttsSupported]);

  const speakAva = useCallback((text) => {
    const spoken = String(text || '').trim();
    if (!spoken) return;
    setLastSpoken(spoken);
    if (!ttsSupported || ttsMuted) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.onstart = () => setAvaStatus('Speaking');
    utter.onend = () => setAvaStatus('Listening');
    window.speechSynthesis.speak(utter);
  }, [ttsMuted, ttsSupported]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const createSession = async (e) => {
    e?.preventDefault?.();
    const goal = prepType.trim();
    if (!goal) {
      setErrorBanner('Tell Ava what you are preparing for.');
      return;
    }
    setLoading(true);
    setErrorBanner('');
    setLoadingStep('Understanding your goal...');

    try {
      let response;
      if (selectedFile) {
        const form = new FormData();
        form.append('prep_type', goal);
        form.append('mode', sessionMode);
        form.append('difficulty', difficulty);
        form.append('pasted_text', pastedText);
        form.append('file', selectedFile);
        response = await api.post('/mirror/sessions', form, {
          transformRequest: [(data, headers) => {
            if (headers) {
              delete headers['Content-Type'];
              delete headers['content-type'];
            }
            return data;
          }]
        });
      } else {
        response = await api.post('/mirror/sessions', {
          prep_type: goal,
          mode: sessionMode,
          difficulty,
          pasted_text: pastedText
        });
      }

      setSession(response.data.session);
      setProfile(response.data.profile);
      setCurrentQuestion(response.data.initial_question);
      setAvaRemark(response.data.ava_remark || response.data.response || "Let's get started.");
      setStage('profile');
    } catch (err) {
      setErrorBanner(err.response?.data?.error || 'Mirror AI is temporarily unavailable.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const toggleRecording = async () => {
    if (!recognitionRef.current) {
      setErrorBanner('Microphone access is unavailable. You can type instead.');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setMicStatus('MICROPHONE ACTIVE');
      return;
    }
    setMicStatus('MICROPHONE REQUESTED');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus('LISTENING');
      speechBaseRef.current = userAnswerText.trim();
      setIsRecording(true);
      setInputMode('voice');
      setAvaStatus('Listening');
      recognitionRef.current.start();
    } catch {
      setMicStatus('MICROPHONE OFF');
      setErrorBanner('Microphone access is unavailable. You can type instead.');
    }
  };

  const handleSubmitAnswer = async () => {
    const text = userAnswerText.trim();
    if (!text || loading || !session) return;

    if (/^(finish|end session)$/i.test(text)) {
      await handleEndSession();
      return;
    }

    setLoading(true);
    setAvaStatus('Thinking');
    setErrorBanner('');
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    const metrics = cameraStatus === 'CAMERA ACTIVE' ? (visualMetrics || deriveVisualMetrics(visualSamplesRef.current)) : null;

    try {
      const endpoint = inputMode === 'voice'
        ? `/mirror/sessions/${session.id}/voice`
        : `/mirror/sessions/${session.id}/message`;
      const response = await api.post(endpoint, {
        message: text,
        inputMode: inputMode,
        visualMetrics: metrics || undefined
      });

      setDialogHistory((prev) => ([
        ...prev,
        {
          question_text: currentQuestion?.question_text,
          answer_text: text,
          input_mode: inputMode
        }
      ]));

      setCurrentQuestion(response.data.next_question || response.data.nextQuestion);
      const spoken = response.data.response || response.data.ava_remark || '';
      setAvaRemark(spoken);
      setLastFeedback(response.data.feedback || null);
      setSessionState(response.data.sessionState || null);
      speakAva(spoken);

      setUserAnswerText('');
      speechBaseRef.current = '';
      setInputMode('text');
    } catch (err) {
      setErrorBanner(err.response?.data?.error || 'Mirror AI is temporarily unavailable.');
      setAvaStatus('Listening');
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setLoading(true);
    stopCamera();
    try {
      const response = await api.post(`/mirror/sessions/${session.id}/complete`);
      const reportData = response.data.report;
      const analysis = response.data.analysis || {};
      setReport({
        communication: parseMaybe(reportData.communication_json, analysis.communication || {}),
        technical: parseMaybe(reportData.technical_json, analysis.technical || {}),
        presentation: parseMaybe(reportData.presentation_json, {
          scores: analysis.scores,
          tensionIndicator: analysis.tensionIndicator,
          practiceSuggestions: analysis.practiceSuggestions,
          strongestArea: analysis.strongestArea,
          improvementArea: analysis.improvementArea,
          nextRecommendation: analysis.nextRecommendation,
          label: 'AI communication coaching score'
        }),
        strengths: parseMaybe(reportData.strengths_json, analysis.strengths || []),
        weaknesses: parseMaybe(reportData.weaknesses_json, analysis.development_areas || []),
        next_challenge: parseMaybe(reportData.next_challenge, analysis.next_challenge || {})
      });
      setStage('report');
    } catch (err) {
      setErrorBanner(err.response?.data?.error || 'Failed to generate session report.');
    } finally {
      setLoading(false);
    }
  };

  const replayVoice = () => {
    if (lastSpoken) speakAva(lastSpoken);
  };

  return (
    <div className="min-h-screen bg-bg-dominant grid grid-cols-1 lg:grid-cols-12 text-text-primary font-sans">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

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
            <a href="/dashboard#challenges" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Target size={14} /> Challenges
            </a>
            <a href="/dashboard#history" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Clock size={14} /> History
            </a>

            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mt-6 mb-2 font-bold">System</div>
            <a href="#settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Settings size={14} /> Settings
            </a>
          </nav>
        </div>

        <div className="space-y-4 pt-6 border-t border-border-default text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-panel-elevated border border-border-default flex items-center justify-center font-bold text-xs text-brand-primary">
              {user.full_name?.charAt(0) || 'D'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold truncate">{user.full_name}</p>
              <p className="text-[9px] text-text-muted truncate">{user.email}</p>
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

      <main className="lg:col-span-10 p-6 lg:p-10 flex flex-col justify-between overflow-y-auto">
        {errorBanner && (
          <div role="alert" className="max-w-4xl mx-auto w-full mb-4 border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono px-4 py-3 rounded">
            {errorBanner}
          </div>
        )}

        {stage === 'setup' && (
          <div className="max-w-4xl mx-auto w-full space-y-8 text-left">
            <div className="border-b border-border-default pb-6">
              <h1 className="text-3xl font-bold tracking-tight">MIRROR AI</h1>
              <p className="text-sm text-text-secondary font-mono mt-1">{timeOfDayGreeting()}.</p>
              <p className="text-base mt-3">Hi, I'm Ava.</p>
              <p className="text-sm text-text-secondary mt-1">What are you preparing for today?</p>
              <p className="text-xs text-brand-primary font-mono mt-2">Let's practice.</p>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 border border-dashed border-border-default rounded-xl bg-panel-default">
                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                <span className="font-mono text-sm text-brand-accent animate-pulse">{loadingStep}</span>
              </div>
            ) : (
              <form onSubmit={createSession} className="space-y-6">
                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-bold font-mono text-brand-primary uppercase tracking-wider">Session mode</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 select-none">
                    {SESSION_MODES.map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        onClick={() => setSessionMode(mode)}
                        className={`p-3 border rounded text-xs font-mono text-center cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                          sessionMode === mode
                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold'
                            : 'border-border-default bg-bg-secondary text-text-secondary hover:border-text-secondary'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {DIFFICULTIES.map((level) => (
                      <button
                        type="button"
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`px-3 py-1.5 border rounded text-[10px] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                          difficulty === level
                            ? 'border-brand-primary text-brand-primary'
                            : 'border-border-default text-text-muted'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-3">
                  <label htmlFor="mirror-goal" className="text-sm font-bold font-mono text-brand-primary uppercase tracking-wider block">
                    Type your response... <span className="text-brand-accent" aria-hidden="true">*</span>
                    <span className="sr-only">required</span>
                  </label>
                  <p className="text-[10px] text-text-muted font-mono">Voice preferred. Typing is required as an accessibility alternative.</p>
                  <div className="flex gap-3">
                    <textarea
                      id="mirror-goal"
                      required
                      value={prepType}
                      onChange={(e) => setPrepType(e.target.value)}
                      className="flex-grow bg-bg-secondary border border-border-default rounded-xl p-4 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary min-h-[88px] font-sans"
                      placeholder="Type your response... e.g. I am preparing for a technical interview."
                    />
                    <button
                      type="button"
                      aria-label="Use microphone"
                      onClick={async () => {
                        speechBaseRef.current = prepType.trim();
                        setUserAnswerText(prepType);
                        await toggleRecording();
                      }}
                      className={`min-w-[52px] min-h-[52px] p-3 rounded-xl border flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                        isRecording ? 'border-red-500 text-red-400' : 'border-border-default text-text-secondary hover:border-brand-primary'
                      }`}
                    >
                      <Mic size={22} />
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-text-muted">Microphone: {micStatus}</p>
                </div>

                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-bold font-mono text-brand-primary uppercase tracking-wider">Optional project context</h2>
                  <div className="border-2 border-dashed border-border-default rounded-xl p-6 flex flex-col items-center justify-center space-y-2 bg-bg-secondary/40">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg,.js,.md"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-panel-default border border-border-default hover:border-brand-primary px-4 py-2 rounded text-xs font-mono text-text-secondary hover:text-text-primary transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      <Upload size={14} /> Upload project material
                    </button>
                    <span className="text-[10px] text-text-muted">ZIP, PDF, DOC, PPT, image, or text. Binary files are not invented from.</span>
                    {selectedFile && (
                      <div className="text-xs text-brand-primary font-mono font-bold mt-1">
                        {selectedFile.name}
                      </div>
                    )}
                  </div>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full bg-bg-secondary border border-border-default rounded-xl p-4 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary min-h-[120px] font-sans"
                    placeholder="Paste a project description, notes, or syllabus. Ava will not invent details that are not here."
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-green-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    Continue with Ava →
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {stage === 'profile' && profile && (
          <div className="max-w-4xl mx-auto w-full space-y-6 text-left">
            <div className="border-b border-border-default pb-4">
              <span className="text-[10px] font-mono text-brand-primary uppercase tracking-wider block font-bold">Preparation profile</span>
              <h1 className="text-2xl font-bold tracking-tight">{profile.prep_title || 'Session ready'}</h1>
              <p className="text-xs text-text-secondary font-mono">Compiled from your goal and any material you provided.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              <div className="md:col-span-2 space-y-4">
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2">
                  <span className="text-[10px] text-text-muted uppercase block font-bold">Topics Found</span>
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {(profile.topics || []).map((t) => (
                      <span key={t} className="px-2.5 py-1 bg-bg-secondary border border-border-default text-text-secondary rounded">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2">
                  <span className="text-[10px] text-text-muted uppercase block font-bold">Skills Requested</span>
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {(profile.skills || []).map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-bg-secondary border border-border-default text-brand-primary rounded">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2.5">
                  <span className="text-[10px] text-text-muted uppercase block font-bold">Important Focus Areas</span>
                  <ul className="list-disc pl-4 space-y-1.5 text-text-secondary">
                    {(profile.important_areas || []).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block font-bold">Goal</span>
                    <span className="text-text-primary font-bold text-sm block mt-0.5">{prepType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block font-bold">Mode</span>
                    <span className="text-text-secondary block mt-0.5">{sessionMode}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block font-bold">Difficulty</span>
                    <span className="text-brand-accent font-bold uppercase block mt-0.5">{profile.difficulty || difficulty}</span>
                  </div>
                </div>
                <button
                  onClick={() => setPermissionPromptOpen(true)}
                  className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-green-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  Start session →
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === 'live' && currentQuestion && (
          <div className="max-w-4xl mx-auto w-full space-y-8 flex flex-col justify-between flex-grow h-[calc(100vh-8rem)]">
            <div className="flex justify-between items-center border-b border-border-default pb-4 text-left select-none">
              <div>
                <span className="text-[10px] font-mono text-brand-primary uppercase tracking-widest block font-bold">Mirror AI</span>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" /> AVA {avaStatus}...
                </h1>
              </div>
              <button
                onClick={handleEndSession}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-1.5 rounded font-mono text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                End Session
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow py-4 min-h-0">
              <div className="md:col-span-2 bg-panel-default border border-border-default rounded-xl p-6 flex flex-col justify-between relative min-h-[300px]">
                <div className="absolute top-4 left-6 flex items-center gap-2 select-none">
                  <div className="w-7 h-7 rounded-full border border-brand-primary flex items-center justify-center bg-bg-secondary text-brand-primary text-[10px] font-bold">AV</div>
                  <div className="text-left">
                    <span className="text-xs font-bold block">AVA</span>
                    <span className="text-[9px] font-mono text-text-muted uppercase">{avaStatus}</span>
                  </div>
                </div>

                <div className="flex-grow flex flex-col justify-center text-left space-y-4 max-w-2xl mt-10 px-2">
                  {avaRemark && (
                    <p className="text-sm text-text-secondary leading-relaxed">{avaRemark}</p>
                  )}
                  <p className="text-base font-medium leading-relaxed">
                    {currentQuestion.question_text}
                  </p>
                  {lastFeedback && (lastFeedback.well || lastFeedback.improve || lastFeedback.tryThis) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
                      <div className="border border-border-default rounded p-3">
                        <span className="text-brand-primary block mb-1">WHAT YOU DID WELL</span>
                        <p className="text-text-secondary font-sans">{lastFeedback.well || '—'}</p>
                      </div>
                      <div className="border border-border-default rounded p-3">
                        <span className="text-yellow-400 block mb-1">AREAS TO IMPROVE</span>
                        <p className="text-text-secondary font-sans">{lastFeedback.improve || '—'}</p>
                      </div>
                      <div className="border border-border-default rounded p-3">
                        <span className="text-text-primary block mb-1">BETTER WAY TO ANSWER</span>
                        <p className="text-text-secondary font-sans">{lastFeedback.tryThis || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setTtsMuted((v) => !v)}
                    className="px-3 py-2 border border-border-default rounded text-[10px] font-mono flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    aria-label={ttsMuted ? 'Unmute Ava' : 'Mute Ava'}
                  >
                    {ttsMuted ? <VolumeX size={14} /> : <Volume2 size={14} />} {ttsMuted ? 'Muted' : 'Mute voice'}
                  </button>
                  <button
                    type="button"
                    onClick={replayVoice}
                    disabled={!lastSpoken}
                    className="px-3 py-2 border border-border-default rounded text-[10px] font-mono flex items-center gap-1.5 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    aria-label="Replay Ava response"
                  >
                    <RotateCcw size={14} /> Replay response
                  </button>
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="bg-panel-default border border-border-default rounded-xl overflow-hidden relative flex-grow min-h-[180px] flex items-center justify-center">
                  {cameraStatus === 'CAMERA ACTIVE' ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-[9px] font-mono text-brand-primary border border-brand-primary/20 select-none">
                        CAMERA ACTIVE
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 select-none">
                      <VideoOff size={24} className="text-text-muted" />
                      <span className="text-[10px] font-mono text-text-muted">{cameraStatus}</span>
                      <span className="text-[10px] text-text-secondary">{cameraNote || 'Camera unavailable'}</span>
                    </div>
                  )}
                </div>

                {(isRecording || loading) && (
                  <div className="bg-panel-default border border-border-default rounded-xl p-4 flex flex-col items-center justify-center space-y-2">
                    <span className="text-[10px] font-mono text-text-muted uppercase block">
                      {loading ? 'PROCESSING' : 'LISTENING'}
                    </span>
                    <Waveform state={loading ? 'PROCESSING' : 'LISTENING'} />
                  </div>
                )}
              </div>
            </div>

            {dialogHistory.length > 0 && (
              <div className="max-h-28 overflow-y-auto border border-border-default rounded-xl p-3 text-[11px] space-y-2 bg-bg-secondary">
                {dialogHistory.map((d, i) => (
                  <div key={i}>
                    <p className="text-brand-primary font-mono">Ava: {d.question_text}</p>
                    <p className="text-text-secondary">You: {d.answer_text}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4 border-t border-border-default pt-4 text-left">
              <div className="space-y-2">
                <label htmlFor="mirror-answer" className="block text-xs font-mono text-text-secondary uppercase">
                  Type your response... <span className="text-brand-accent">*</span>
                </label>
                <div className="flex gap-3">
                  <textarea
                    id="mirror-answer"
                    value={userAnswerText}
                    onChange={(e) => {
                      setUserAnswerText(e.target.value);
                      speechBaseRef.current = e.target.value;
                      setInputMode('text');
                    }}
                    className="flex-grow bg-bg-secondary border border-border-default rounded-xl p-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary min-h-[80px] font-sans"
                    placeholder="Type your response..."
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={loading || !userAnswerText.trim()}
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 select-none shadow-green-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    Send
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center bg-bg-secondary border border-border-default rounded-xl p-3 select-none">
                <div className="flex gap-2">
                  <button
                    onClick={toggleRecording}
                    aria-label="Microphone"
                    className={`min-w-[44px] min-h-[44px] p-2 rounded border transition-all flex items-center gap-1.5 text-xs font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                      isRecording
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-border-default hover:border-brand-primary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Mic size={16} /> {isRecording ? 'Stop' : 'Voice'}
                  </button>
                  <button
                    onClick={() => {
                      if (cameraStatus === 'CAMERA ACTIVE' || wantCamera) {
                        stopCamera();
                        setWantCamera(false);
                        setCameraStatus('CAMERA NOT CONNECTED');
                      } else {
                        setWantCamera(true);
                      }
                    }}
                    aria-label="Camera"
                    className={`min-w-[44px] min-h-[44px] p-2 rounded border transition-all flex items-center gap-1.5 text-xs font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                      cameraStatus === 'CAMERA ACTIVE'
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                        : 'border-border-default hover:border-brand-primary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Camera size={16} /> Camera
                  </button>
                </div>
                <div className="text-[10px] font-mono text-text-muted text-right space-y-0.5">
                  <div>{micStatus}{!speechSupported ? ' · type instead' : ''}</div>
                  <div>{cameraStatus}</div>
                  {sessionState?.tensionIndicator && (
                    <div>Possible tension indicators: {sessionState.tensionIndicator}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 'report' && report && (
          <div className="max-w-4xl mx-auto w-full space-y-8 text-left">
            <div className="border-b border-border-default pb-6 select-none">
              <h1 className="text-3xl font-bold tracking-tight">MIRROR AI SESSION REPORT</h1>
              <p className="text-sm text-text-secondary font-mono mt-1">
                {report.presentation?.label || 'AI communication coaching score'} · not a medical or scientific assessment
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              <div className="md:col-span-2 space-y-6">
                {report.presentation?.scores && (
                  <div className="bg-panel-default border border-border-default rounded-xl p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(report.presentation.scores).map(([k, v]) => (
                      <div key={k} className="border border-border-default rounded p-3">
                        <span className="text-text-muted uppercase block text-[9px]">{k}</span>
                        <span className="text-brand-primary text-lg font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider border-b border-border-default pb-2">
                    Communication Analysis
                  </h3>
                  <div className="space-y-4 font-sans text-xs text-text-secondary leading-relaxed">
                    <div>
                      <span className="font-bold font-mono text-[10px] text-text-muted uppercase block">Clarity</span>
                      <p className="mt-1">{report.communication.clarity}</p>
                    </div>
                    <div>
                      <span className="font-bold font-mono text-[10px] text-text-muted uppercase block">Structure</span>
                      <p className="mt-1">{report.communication.structure_feedback}</p>
                    </div>
                    <div className="p-3 bg-bg-secondary border border-border-default rounded font-mono text-xs flex justify-between items-center select-none">
                      <span className="text-text-muted">Filler words observed:</span>
                      <span className="font-bold text-brand-primary">{report.communication.filler_words_count}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider border-b border-border-default pb-2">
                    Technical explanation
                  </h3>
                  <p className="font-sans text-xs text-text-secondary">{report.technical.explanation_quality}</p>
                  <div className="grid grid-cols-2 gap-4 font-mono text-[11px] pt-2">
                    <div className="p-3 bg-bg-secondary rounded border border-border-default">
                      <span className="text-brand-primary font-bold block mb-1">Strong Topics</span>
                      <ul className="list-disc pl-4 space-y-1 text-text-secondary">
                        {(report.technical.strong_areas || []).map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="p-3 bg-bg-secondary rounded border border-border-default">
                      <span className="text-red-400 font-bold block mb-1">Needs Practice</span>
                      <ul className="list-disc pl-4 space-y-1 text-text-secondary">
                        {(report.technical.weak_areas || []).map((w) => <li key={w}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-brand-primary uppercase font-mono tracking-wider">Strengths</h4>
                    {(report.strengths || []).map((s, idx) => (
                      <div key={idx} className="border-b border-border-default/30 pb-2 last:border-0">
                        <span className="font-bold text-text-primary block font-mono text-[10px]">{s.area}</span>
                        <p className="mt-0.5 text-text-secondary">{s.evidence}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-yellow-400 uppercase font-mono tracking-wider">Improvements</h4>
                    {(report.weaknesses || []).map((w, idx) => (
                      <div key={idx} className="border-b border-border-default/30 pb-2 last:border-0">
                        <span className="font-bold text-text-primary block font-mono text-[10px]">{w.area}</span>
                        <p className="mt-0.5 text-text-secondary">{w.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-brand-primary uppercase font-mono tracking-wider">Possible tension indicators</h4>
                  <p className="text-sm font-bold">{report.presentation?.tensionIndicator || 'MOSTLY STEADY'}</p>
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Based on observable communication signals. This is not a diagnosis and does not determine emotional state.
                  </p>
                </div>
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2 text-xs text-text-secondary">
                  <p><span className="text-brand-primary font-bold">Strongest area:</span> {report.presentation?.strongestArea || report.next_challenge?.title}</p>
                  <p><span className="text-brand-primary font-bold">Main improvement:</span> {report.presentation?.improvementArea}</p>
                  <p><span className="text-brand-primary font-bold">Next time, practice:</span> {report.presentation?.nextRecommendation}</p>
                </div>
                {report.presentation?.practiceSuggestions?.length > 0 && (
                  <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2">
                    <h4 className="text-xs font-bold text-brand-accent uppercase font-mono">Practice suggestions</h4>
                    <ul className="list-disc pl-4 text-xs text-text-secondary space-y-1">
                      {report.presentation.practiceSuggestions.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-[10px] text-text-muted">
                  Privacy: derived metrics and transcripts are stored for your account. Raw camera video is not uploaded continuously.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-2.5 bg-panel-default border border-border-default hover:border-brand-primary text-text-secondary hover:text-brand-primary rounded font-mono text-xs font-bold transition-all text-center"
                >
                  Close report
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {permissionPromptOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel-default border border-border-default max-w-sm w-full rounded-xl p-6 space-y-4 text-left font-mono text-xs select-none">
            <div className="flex justify-between items-center border-b border-border-default pb-3">
              <span className="font-bold text-text-primary uppercase tracking-wider">Permissions</span>
              <button onClick={() => setPermissionPromptOpen(false)} className="text-text-muted hover:text-text-primary" aria-label="Close">×</button>
            </div>
            <p className="text-text-secondary leading-relaxed font-sans">
              Camera is used only to provide communication coaching based on visible interaction signals. You can continue without camera or microphone.
            </p>
            <label className="flex items-start gap-2.5 p-3.5 bg-bg-secondary/40 border border-border-default rounded cursor-pointer">
              <input type="checkbox" checked={useVoice} onChange={(e) => setUseVoice(e.target.checked)} className="mt-1 cursor-pointer" />
              <div>
                <span className="font-bold text-text-primary block">Voice (preferred)</span>
                <span className="text-[10px] text-text-secondary font-sans block mt-0.5">Typing remains available.</span>
              </div>
            </label>
            <label className="flex items-start gap-2.5 p-3.5 bg-bg-secondary/40 border border-border-default rounded cursor-pointer">
              <input type="checkbox" checked={wantCamera} onChange={(e) => setWantCamera(e.target.checked)} className="mt-1 cursor-pointer" />
              <div>
                <span className="font-bold text-text-primary block">Camera (optional)</span>
                <span className="text-[10px] text-text-secondary font-sans block mt-0.5">Denied camera does not block the session.</span>
              </div>
            </label>
            <button
              onClick={() => {
                setPermissionPromptOpen(false);
                speakAva(avaRemark);
                setStage('live');
              }}
              className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent py-3 rounded font-bold uppercase tracking-wider transition-all shadow-green-glow"
            >
              Start practice session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MirrorCoach;
