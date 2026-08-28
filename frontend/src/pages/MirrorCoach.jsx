import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Shield, Camera, Mic, Type, Play, X, BarChart2, FolderOpen, 
  Target, Clock, Settings, LogOut, Loader2, Award, Zap, AlertCircle, ArrowRight, VideoOff, Upload
} from 'lucide-react';
import api from '../utils/api';
import Waveform from '../components/Waveform';

const MirrorCoach = ({ user, handleLogout }) => {
  const navigate = useNavigate();
  // Session lifecycle states: 'setup', 'profile', 'live', 'report'
  const [stage, setStage] = useState('setup'); 
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // Uploading, Processing, Understanding
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);

  // Setup options
  const [prepType, setPrepType] = useState('Technical Interview');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Live session state
  const [dialogHistory, setDialogHistory] = useState([]); // Questions + answers dialog
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [avaRemark, setAvaRemark] = useState("Let's get started.");
  const [userAnswerText, setUserAnswerText] = useState('');
  const [inputMode, setInputMode] = useState('text'); // voice | text

  // Permission requests
  const [useVoice, setUseVoice] = useState(true);
  const [useCamera, setUseCamera] = useState(false);
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);

  // Camera preview stream ref
  const videoRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [gazeShiftsCount, setGazeShiftsCount] = useState(0);

  // Voice recording ref
  const recognitionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);

  // Mock prep list
  const prepTypesList = [
    'Job Interview', 'Technical Interview', 'HR Interview', 
    'Hackathon Presentation', 'Project Presentation', 'Viva', 
    'Exam', 'Public Speaking', 'Client Meeting', 'Team Meeting', 
    'Technical Discussion', 'Custom Preparation'
  ];

  // Initialize Speech recognition hook
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setUserAnswerText(prev => prev + ' ' + (finalTranscript || interimTranscript));
      };

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Control camera feed
  useEffect(() => {
    if (stage === 'live' && useCamera && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          // Simulate observable presentation signals: shift gaze tracking randomly for realistic telemetry
          const interval = setInterval(() => {
            if (Math.random() > 0.75) {
              setGazeShiftsCount(prev => prev + 1);
            }
          }, 3500);
          return () => clearInterval(interval);
        })
        .catch((err) => {
          console.error("Camera access failed:", err);
          setUseCamera(false);
        });
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [stage, useCamera]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPastedText(`[Uploaded File: ${file.name}]`);
    }
  };

  // Submit prep files & extract profile
  const handleProcessMaterial = async (e) => {
    e.preventDefault();
    setLoading(true);

    const steps = ['Uploading...', 'Processing...', 'Understanding...'];
    let stepIndex = 0;
    setLoadingStep(steps[0]);

    const interval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        setLoadingStep(steps[stepIndex]);
      }
    }, 1200);

    try {
      const response = await api.post('/mirror/sessions', {
        prep_type: prepType,
        pasted_text: pastedText || `Preparation for ${prepType}`
      });

      clearInterval(interval);
      setLoadingStep('Preparation profile ready ✓');
      setTimeout(() => {
        setSession(response.data.session);
        setProfile(response.data.profile);
        setCurrentQuestion(response.data.initial_question);
        setStage('profile');
        setLoading(false);
      }, 800);

    } catch (err) {
      clearInterval(interval);
      alert('Failed to parse material: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  // Toggle voice recognition recording
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Voice transcription is not supported in this browser. Please type your answer.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      setInputMode('voice');
      recognitionRef.current.start();
    }
  };

  // Submit answer and fetch next adaptive question
  const handleSubmitAnswer = async () => {
    if (!userAnswerText.trim() || loading) return;

    setLoading(true);
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    // Capture observable gaze shifts count telemetry if camera was active
    const signalsText = useCamera 
      ? `Observable signals: ${gazeShiftsCount} minor gaze shifts registered.`
      : null;

    try {
      const response = await api.post(`/mirror/sessions/${session.id}/submit-answer`, {
        answer_text: userAnswerText,
        input_mode: inputMode,
        observational_signals: signalsText
      });

      // Save question-answer dialog to current view logs
      const updatedDialogs = [...dialogHistory, {
        question_text: currentQuestion.question_text,
        answer_text: userAnswerText,
        input_mode: inputMode
      }];
      setDialogHistory(updatedDialogs);

      if (response.data.session_limit_reached) {
        alert(response.data.message);
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(response.data.next_question);
        setAvaRemark(response.data.ava_remark);
      }

      setUserAnswerText('');
      setInputMode('text');
      setLoading(false);

    } catch (err) {
      alert('Error submitting answer: ' + err.message);
      setLoading(false);
    }
  };

  // End conversational session & retrieve Mirror Reflection report
  const handleEndSession = async () => {
    setLoading(true);
    stopCamera();

    try {
      const response = await api.post(`/mirror/sessions/${session.id}/end`);
      const reportData = response.data.report;

      setReport({
        communication: JSON.parse(reportData.communication_json),
        technical: JSON.parse(reportData.technical_json),
        presentation: JSON.parse(reportData.presentation_json || '{}'),
        strengths: JSON.parse(reportData.strengths_json),
        weaknesses: JSON.parse(reportData.weaknesses_json),
        next_challenge: JSON.parse(reportData.next_challenge || '{}')
      });

      setStage('report');
      setLoading(false);
    } catch (err) {
      alert('Failed to generate reflection report: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

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

      {/* Main Workspace Frame */}
      <main className="lg:col-span-10 p-6 lg:p-10 flex flex-col justify-between overflow-y-auto">
        
        {/* SETUP STAGE */}
        {stage === 'setup' && (
          <div className="max-w-4xl mx-auto w-full space-y-8 text-left">
            <div className="border-b border-border-default pb-6">
              <h1 className="text-3xl font-bold tracking-tight">MIRROR AI</h1>
              <p className="text-sm text-text-secondary font-mono mt-1">“Prepare for anything. Practice with your own context.”</p>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 border border-dashed border-border-default rounded-xl bg-panel-default">
                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                <span className="font-mono text-sm text-brand-accent animate-pulse">{loadingStep}</span>
              </div>
            ) : (
              <form onSubmit={handleProcessMaterial} className="space-y-6">
                
                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-bold font-mono text-brand-primary uppercase tracking-wider">What are you preparing for?</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 select-none">
                    {prepTypesList.map(type => (
                      <div
                        key={type}
                        onClick={() => setPrepType(type)}
                        className={`p-3 border rounded text-xs font-mono text-center cursor-pointer transition-all ${
                          prepType === type 
                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-bold shadow-green-glow/10' 
                            : 'border-border-default bg-bg-secondary text-text-secondary hover:border-text-secondary'
                        }`}
                      >
                        {type}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-bold font-mono text-brand-primary uppercase tracking-wider">What should I know about your preparation?</h2>
                  
                  <div className="space-y-4">
                    
                    {/* File Upload Selector */}
                    <div className="border-2 border-dashed border-border-default rounded-xl p-6 flex flex-col items-center justify-center space-y-2 bg-bg-secondary/40">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-panel-default border border-border-default hover:border-brand-primary px-4 py-2 rounded text-xs font-mono text-text-secondary hover:text-text-primary transition-all flex items-center gap-1.5"
                      >
                        <Upload size={14} /> Choose Preparation Document
                      </button>
                      <span className="text-[10px] text-text-muted">PDF, DOC, DOCX, PPT, PPTX or TXT (Max 5MB)</span>
                      
                      {selectedFile && (
                        <div className="text-xs text-brand-primary font-mono font-bold mt-1">
                          ✓ {selectedFile.name} (Ready)
                        </div>
                      )}
                    </div>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-border-default"></div>
                      <span className="flex-shrink mx-4 text-[10px] font-mono text-text-muted uppercase">OR Paste Content</span>
                      <div className="flex-grow border-t border-border-default"></div>
                    </div>

                    {/* Text Area fallback */}
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-xl p-4 text-xs focus:outline-none min-h-[140px] font-sans"
                      placeholder="Paste job descriptions, resume topics, project logs, or study syllabi here..."
                    />

                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-green-glow"
                  >
                    Build Prep Profile →
                  </button>
                </div>

              </form>
            )}
          </div>
        )}

        {/* PROFILE PROFILE STAGE */}
        {stage === 'profile' && profile && (
          <div className="max-w-4xl mx-auto w-full space-y-6 text-left">
            <div className="border-b border-border-default pb-4">
              <span className="text-[10px] font-mono text-brand-primary uppercase tracking-wider block font-bold">Step 2 / Profile Compiled</span>
              <h1 className="text-2xl font-bold tracking-tight">PREPARATION PROFILE</h1>
              <p className="text-xs text-text-secondary font-mono">Profile compiled from your actual context documents.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              
              <div className="md:col-span-2 space-y-4">
                
                {/* Topics card */}
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2">
                  <span className="text-[10px] text-text-muted uppercase block font-bold">Topics Found</span>
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {profile.topics && profile.topics.map(t => (
                      <span key={t} className="px-2.5 py-1 bg-bg-secondary border border-border-default text-text-secondary rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skills card */}
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2">
                  <span className="text-[10px] text-text-muted uppercase block font-bold">Skills Requested</span>
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {profile.skills && profile.skills.map(s => (
                      <span key={s} className="px-2.5 py-1 bg-bg-secondary border border-border-default text-brand-primary rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Important Areas card */}
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2.5">
                  <span className="text-[10px] text-text-muted uppercase block font-bold">Important Focus Areas</span>
                  <ul className="list-disc pl-4 space-y-1.5 text-text-secondary">
                    {profile.important_areas && profile.important_areas.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>

              </div>

              <div className="space-y-4">
                
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block font-bold">Prep Category</span>
                    <span className="text-text-primary font-bold text-sm block mt-0.5">{prepType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block font-bold">Material Title</span>
                    <span className="text-text-secondary block mt-0.5 truncate">{profile.prep_title}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block font-bold">Difficulty Rank</span>
                    <span className="text-brand-accent font-bold uppercase block mt-0.5">{profile.difficulty}</span>
                  </div>
                </div>

                <button
                  onClick={() => setPermissionPromptOpen(true)}
                  className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-green-glow"
                >
                  Configure Hardware Devices →
                </button>

              </div>

            </div>
          </div>
        )}

        {/* LIVE SESSION STAGE */}
        {stage === 'live' && currentQuestion && (
          <div className="max-w-4xl mx-auto w-full space-y-8 flex flex-col justify-between flex-grow h-[calc(100vh-8rem)]">
            
            {/* Session Top Bar */}
            <div className="flex justify-between items-center border-b border-border-default pb-4 text-left select-none">
              <div>
                <span className="text-[10px] font-mono text-brand-primary uppercase tracking-widest block font-bold">Practice Studio</span>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> MIRROR SESSION LIVE
                </h1>
              </div>
              <button
                onClick={handleEndSession}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-1.5 rounded font-mono text-xs font-bold transition-all"
              >
                End Session
              </button>
            </div>

            {/* Conversational Layout (Ava & Camera split) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow py-4 min-h-0">
              
              {/* Left Column: Ava AI Coach displays */}
              <div className="md:col-span-2 bg-panel-default border border-border-default rounded-xl p-6 flex flex-col justify-between items-center relative min-h-[300px]">
                
                {/* Ava Profile Info */}
                <div className="absolute top-4 left-6 flex items-center gap-2 select-none">
                  <div className="w-7 h-7 rounded-full border border-brand-primary flex items-center justify-center bg-bg-secondary text-brand-primary text-[10px] font-bold">
                    AV
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold block">AVA</span>
                    <span className="text-[9px] font-mono text-text-muted uppercase">Coaching Agent</span>
                  </div>
                </div>

                <div className="flex-grow flex flex-col justify-center items-center text-center space-y-4 max-w-lg mt-8">
                  {avaRemark && (
                    <span className="text-[10px] font-mono text-brand-accent uppercase tracking-wider bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/10">
                      {avaRemark}
                    </span>
                  )}
                  <p className="text-base font-medium leading-relaxed">
                    "{currentQuestion.question_text}"
                  </p>
                </div>

                <div className="w-full select-none text-center">
                  <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider block">Ava adaptive dialogue prompt</span>
                </div>
              </div>

              {/* Right Column: Hardware Telemetry previews */}
              <div className="space-y-4 flex flex-col justify-between">
                
                {/* Camera Viewport box */}
                <div className="bg-panel-default border border-border-default rounded-xl overflow-hidden relative flex-grow min-h-[180px] flex items-center justify-center">
                  {useCamera ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-[9px] font-mono text-brand-primary border border-brand-primary/20 select-none">
                        ● TELEMETRY RECORDING
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 select-none">
                      <VideoOff size={24} className="text-text-muted" />
                      <span className="text-[10px] font-mono text-text-muted">Camera Stream Off</span>
                    </div>
                  )}
                </div>

                {/* Voice waveform when recording */}
                {isRecording && (
                  <div className="bg-panel-default border border-border-default rounded-xl p-4 flex flex-col items-center justify-center space-y-2">
                    <span className="text-[10px] font-mono text-text-muted uppercase block">Waveform Indicator</span>
                    <Waveform state="LISTENING" />
                  </div>
                )}

              </div>

            </div>

            {/* Answer & Controls Area */}
            <div className="space-y-4 border-t border-border-default pt-4 text-left">
              
              <div className="space-y-2">
                <label className="block text-xs font-mono text-text-secondary uppercase">
                  {inputMode === 'voice' ? 'Transcribing Response...' : 'Type your answer...'}
                </label>
                <div className="flex gap-3">
                  <textarea
                    value={userAnswerText}
                    onChange={(e) => {
                      setUserAnswerText(e.target.value);
                      setInputMode('text');
                    }}
                    className="flex-grow bg-bg-secondary border border-border-default rounded-xl p-3 text-xs focus:outline-none min-h-[80px] font-sans"
                    placeholder="Provide your answer to Ava's question..."
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={loading || !userAnswerText.trim()}
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 select-none shadow-green-glow"
                  >
                    Submit
                  </button>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex justify-between items-center bg-bg-secondary border border-border-default rounded-xl p-3 select-none">
                <div className="flex gap-2">
                  <button
                    onClick={toggleRecording}
                    className={`p-2 rounded border transition-all flex items-center gap-1.5 text-xs font-mono font-bold ${
                      isRecording 
                        ? 'border-red-500 bg-red-500/10 text-red-400' 
                        : 'border-border-default hover:border-brand-primary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Mic size={14} /> {isRecording ? 'Mute Mic' : 'Record Voice'}
                  </button>

                  <button
                    onClick={() => setUseCamera(!useCamera)}
                    className={`p-2 rounded border transition-all flex items-center gap-1.5 text-xs font-mono font-bold ${
                      useCamera 
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' 
                        : 'border-border-default hover:border-brand-primary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Camera size={14} /> {useCamera ? 'Disable Camera' : 'Enable Camera'}
                  </button>
                </div>

                <span className="text-[10px] font-mono text-text-muted">
                  Questions asked: {dialogHistory.length} / 5
                </span>
              </div>

            </div>

          </div>
        )}

        {/* REPORT STAGE */}
        {stage === 'report' && report && (
          <div className="max-w-4xl mx-auto w-full space-y-8 text-left">
            
            <div className="border-b border-border-default pb-6 select-none">
              <h1 className="text-3xl font-bold tracking-tight">MIRROR REFLECTION REPORT</h1>
              <p className="text-sm text-text-secondary font-mono mt-1">Practice session complete. Real analytics of your technical mastery.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              
              <div className="md:col-span-2 space-y-6">
                
                {/* 1. COMMUNICATION REPORT */}
                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider border-b border-border-default pb-2">
                    💬 Communication Analysis
                  </h3>
                  <div className="space-y-4 font-sans text-xs text-text-secondary leading-relaxed">
                    <div>
                      <span className="font-bold font-mono text-[10px] text-text-muted uppercase block">Clarity Feedback</span>
                      <p className="mt-1">{report.communication.clarity}</p>
                    </div>
                    <div>
                      <span className="font-bold font-mono text-[10px] text-text-muted uppercase block">Answer Structure</span>
                      <p className="mt-1">{report.communication.structure_feedback}</p>
                    </div>
                    <div className="p-3 bg-bg-secondary border border-border-default rounded font-mono text-xs flex justify-between items-center select-none">
                      <span className="text-text-muted">Filler words count:</span>
                      <span className="font-bold text-brand-primary">{report.communication.filler_words_count}</span>
                    </div>
                  </div>
                </div>

                {/* 2. TECHNICAL UNDERSTANDING REPORT */}
                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider border-b border-border-default pb-2">
                    🧠 Technical Mastery
                  </h3>
                  <div className="space-y-4 font-sans text-xs text-text-secondary leading-relaxed">
                    <div>
                      <span className="font-bold font-mono text-[10px] text-text-muted uppercase block">Terminology & Explanations</span>
                      <p className="mt-1">{report.technical.explanation_quality}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 font-mono text-[11px] pt-2">
                      <div className="p-3 bg-bg-secondary rounded border border-border-default">
                        <span className="text-brand-primary font-bold block mb-1">Strong Topics</span>
                        <ul className="list-disc pl-4 space-y-1 text-text-secondary">
                          {report.technical.strong_areas && report.technical.strong_areas.map(s => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 bg-bg-secondary rounded border border-border-default">
                        <span className="text-red-400 font-bold block mb-1">Needs Practice</span>
                        <ul className="list-disc pl-4 space-y-1 text-text-secondary">
                          {report.technical.weak_areas && report.technical.weak_areas.map(w => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 3. STRENGTHS & DEVELOPMENT AREAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-brand-primary uppercase font-mono tracking-wider">★ Your Strengths</h4>
                    <div className="space-y-2 text-xs font-sans text-text-secondary leading-relaxed">
                      {report.strengths && report.strengths.map((s, idx) => (
                        <div key={idx} className="border-b border-border-default/30 pb-2 last:border-0">
                          <span className="font-bold text-text-primary block font-mono text-[10px]">{s.area}</span>
                          <p className="mt-0.5">"{s.evidence}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-yellow-400 uppercase font-mono tracking-wider">▲ Areas to Develop</h4>
                    <div className="space-y-2 text-xs font-sans text-text-secondary leading-relaxed">
                      {report.weaknesses && report.weaknesses.map((w, idx) => (
                        <div key={idx} className="border-b border-border-default/30 pb-2 last:border-0">
                          <span className="font-bold text-text-primary block font-mono text-[10px]">{w.area}</span>
                          <p className="mt-0.5">"{w.evidence}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

              {/* Right Column: Presentation mirror & Challenges */}
              <div className="space-y-6">
                
                {/* Presentation Mirror */}
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-brand-primary uppercase font-mono tracking-wider">🪞 Presentation Mirror</h4>
                  
                  {useCamera ? (
                    <div className="space-y-3 font-sans text-xs text-text-secondary">
                      <div>
                        <span className="font-bold font-mono text-[10px] text-text-muted uppercase block">Observable signals</span>
                        <p className="mt-1">Observable presentation signals verified minor gaze shifts during response iterations.</p>
                      </div>
                      <div className="p-3 bg-bg-secondary rounded border border-border-default font-mono text-[10px] text-text-muted leading-relaxed">
                        Camera analysis provides observable presentation signals. It does not determine your true emotional state and is not a medical assessment.
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center border border-dashed border-border-default rounded text-[10px] text-text-muted uppercase">
                      Camera Not Used
                    </div>
                  )}
                </div>

                {/* Personalized challenge */}
                {report.next_challenge && (
                  <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-brand-accent uppercase font-mono tracking-wider">🎯 Recommended Next Challenge</h4>
                    <div className="space-y-2 font-sans text-xs text-text-secondary">
                      <span className="font-bold text-text-primary block font-mono text-[10px]">{report.next_challenge.title}</span>
                      <p className="leading-relaxed">{report.next_challenge.description}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-2.5 bg-panel-default border border-border-default hover:border-brand-primary text-text-secondary hover:text-brand-primary rounded font-mono text-xs font-bold transition-all text-center"
                >
                  Close Reflection Report
                </button>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Permission Prompts Modal */}
      {permissionPromptOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel-default border border-border-default max-w-sm w-full rounded-xl p-6 space-y-4 text-left font-mono text-xs select-none">
            <div className="flex justify-between items-center border-b border-border-default pb-3">
              <span className="font-bold text-text-primary uppercase tracking-wider">Device Permissions</span>
              <button onClick={() => setPermissionPromptOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <p className="text-text-secondary leading-relaxed font-sans">
              To proceed to the live Mirror Coach studio, configure which diagnostic inputs you would like to enable:
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-2.5 p-3.5 bg-bg-secondary/40 border border-border-default rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={useVoice}
                  onChange={(e) => setUseVoice(e.target.checked)}
                  className="mt-1 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-text-primary block">🎙️ Enable Voice Interaction</span>
                  <span className="text-[10px] text-text-secondary font-sans leading-normal block mt-0.5">
                    Recommended. Enables microphone audio transcription to speak answers naturally to Ava.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3.5 bg-bg-secondary/40 border border-border-default rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCamera}
                  onChange={(e) => setUseCamera(e.target.checked)}
                  className="mt-1 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-text-primary block">📷 Enable Presentation Mirror</span>
                  <span className="text-[10px] text-text-secondary font-sans leading-normal block mt-0.5">
                    Optional. Uses webcam streams to monitor observable head posture or gaze shifts.
                  </span>
                </div>
              </label>
            </div>

            <div className="p-3 bg-bg-secondary rounded border border-border-default text-[10px] text-text-muted leading-relaxed font-sans">
              Camera/microphone analysis provides observable presentation signals. It does not determine your true emotional state and is not a medical or psychological assessment.
            </div>

            <button
              onClick={() => {
                setPermissionPromptOpen(false);
                setStage('live');
              }}
              className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent py-3 rounded font-bold uppercase tracking-wider transition-all shadow-green-glow"
            >
              Start Practice Session
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MirrorCoach;
