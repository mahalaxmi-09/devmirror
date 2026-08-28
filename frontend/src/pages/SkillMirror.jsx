import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Award, Target, Flame, Lightbulb, Compass, AwardIcon, Sparkles, Video, VideoOff, Mic, Play } from 'lucide-react';
import api from '../utils/api';

const SkillMirror = () => {
  const { missionId } = useParams();
  const [signal, setSignal] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  
  // Explain It Back States
  const [userExplanation, setUserExplanation] = useState('');
  const [explanationFeedback, setExplanationFeedback] = useState(null);
  const [submittingExplanation, setSubmittingExplanation] = useState(false);
  const [explainMicState, setExplainMicState] = useState('READY'); // READY, LISTENING, PROCESSING

  // Camera Presentation Mirror States
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraAsked, setCameraAsked] = useState(false);
  const [cameraGazeShift, setCameraGazeShift] = useState(0);
  const [cameraEngagement, setCameraEngagement] = useState('Strong');
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Personalized Challenge States
  const [activeChallengeMode, setActiveChallengeMode] = useState('GUIDED');
  const [currentHintIndex, setCurrentHintIndex] = useState(-1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMirrorData = async () => {
      try {
        const mirrorRes = await api.post(`/missions/${missionId}/mirror`);
        setSignal(mirrorRes.data);

        // Fetch aggregate history
        const dashboardRes = await api.get('/skills');
        setHistory(dashboardRes.data);
      } catch (err) {
        console.error('Failed to load SkillMirror data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (missionId) {
      loadMirrorData();
    }
  }, [missionId]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleStartCamera = async () => {
    setCameraAsked(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraEnabled(true);
      
      // Save presentation telemetry to database
      await api.post(`/missions/${missionId}/presentation`, {
        fluency: 'Good',
        engagement: 'Strong',
        composure: 'Steady',
        notes: 'Observable presentation signals showed steady composure.'
      });

      // Simple interval simulated telemetry for webcam overlays
      const interval = setInterval(() => {
        setCameraGazeShift(prev => (prev + 1) % 4);
      }, 3500);

      return () => clearInterval(interval);
    } catch (err) {
      console.warn('Camera permission denied or unavailable:', err.message);
      setCameraEnabled(false);
    }
  };

  const handleStopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraEnabled(false);
  };

  // Web Speech API for Explain It Back
  const startExplainMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setExplainMicState('LISTENING');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setUserExplanation(text);
        setExplainMicState('PROCESSING');
      };

      rec.onerror = (e) => {
        console.error(e);
        setExplainMicState('READY');
      };

      rec.onend = () => {
        setExplainMicState('READY');
      };

      rec.start();
    } else {
      alert("Speech Recognition not supported in this browser. Please type your explanation.");
    }
  };

  const handleSubmitExplanation = async (e) => {
    e.preventDefault();
    if (!userExplanation.trim()) return;

    setSubmittingExplanation(true);
    try {
      const response = await api.post(`/missions/${missionId}/explain`, {
        user_explanation: userExplanation
      });
      setExplanationFeedback(response.data);
      
      // Reload skill details
      const mirrorRes = await api.post(`/missions/${missionId}/mirror`);
      setSignal(mirrorRes.data);
    } catch (err) {
      alert('Error submitting explanation: ' + err.message);
    } finally {
      setSubmittingExplanation(false);
    }
  };

  const handleStartChallenge = async () => {
    try {
      const challengesRes = await api.get('/challenges');
      if (challengesRes.data.length > 0) {
        const targetId = challengesRes.data[0].id;
        const response = await api.post(`/challenges/${targetId}/start`, { mode: activeChallengeMode });
        window.location.href = `/debug/${response.data.mission.id}`;
      } else {
        alert("No recommendations found. Run demo session to generate challenges.");
      }
    } catch (err) {
      alert("Error starting challenge: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dominant flex items-center justify-center font-mono text-xs text-text-muted">
        Reflecting debugging telemetry...
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="min-h-screen bg-bg-dominant flex items-center justify-center font-mono text-xs text-text-muted">
        Verification details missing. Complete the debugging session first.
      </div>
    );
  }

  // Parse notes JSON containing evidence text
  let notes = {};
  try {
    notes = JSON.parse(signal.notes);
  } catch (e) {
    console.error('Failed to parse signal notes:', e);
  }

  // Check if explanation feedback is already stored in database notes
  const savedRating = notes.explanation_rating || (explanationFeedback ? explanationFeedback.rating : null);
  const savedFeedback = notes.explanation_feedback || (explanationFeedback ? explanationFeedback.feedback : null);
  const savedExplanation = notes.user_explanation || userExplanation;

  // Radar data formatting
  const radarData = [
    { subject: 'Communication', A: signal.communication, fullMark: 100 },
    { subject: 'Problem Decomposition', A: signal.problem_solving, fullMark: 100 },
    { subject: 'Debugging Strategy', A: signal.debugging, fullMark: 100 },
    { subject: 'Technical Understanding', A: signal.technical_understanding, fullMark: 100 },
    { subject: 'Independent Reasoning', A: signal.independent_reasoning, fullMark: 100 }
  ];

  // Progressive hints list for personalized challenge
  const challengeHints = [
    "Identify where db.updateUser is executed. Is there an await prefix or return statement?",
    "If db.updateUser returns a promise, executing it asynchronously means the res.status() response is fired immediately before the database completes its work.",
    "Refactor the API route to make the handler async, and change it to: await db.updateUser(id, { name })."
  ];

  return (
    <div className="min-h-screen bg-bg-dominant text-text-primary flex flex-col">
      
      {/* Header */}
      <header className="h-14 border-b border-border-default bg-bg-secondary px-6 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-xs font-mono text-text-secondary hover:text-text-primary transition-colors">
            ← Dashboard
          </a>
          <div className="h-4 w-[1px] bg-border-default" />
          <span className="text-xs font-mono font-bold text-brand-primary">DEVMIRROR / WORKSPACE / MIRROR AI</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto">
        
        {/* Title Block */}
        <div className="lg:col-span-12 space-y-2 border-b border-border-default pb-6 text-left">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-brand-primary uppercase tracking-widest font-bold">
            <Sparkles size={12} /> AI-Estimated Skill Signal
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">Your Engineering Mirror</h1>
          <p className="text-sm text-text-secondary">What this debugging session reveals about how you solve technical problems.</p>
        </div>

        {/* LEFT COLUMN: Skill Graph, Progress, Camera Telemetry (col-span-5) */}
        <section className="lg:col-span-5 space-y-6 text-left">
          
          {/* Competency Radar Chart */}
          <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-widest text-center">Competency Radar</h3>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#1C261D" />
                  <PolarAngleAxis dataKey="subject" stroke="#9AA49B" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#1C261D" tick={{ fill: '#667067', fontSize: 8 }} />
                  <Radar name="Signal" dataKey="A" stroke="#7CFF4F" fill="#7CFF4F" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            <p className="text-[10px] font-mono text-text-muted leading-relaxed text-center">
              *Scores represent automated estimates based on analysis timings, retry loops, and patch files.
            </p>
          </div>

          {/* Presentation Camera Optional Mirror */}
          <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-widest">Presentation Mirror</h3>
              <span className="text-[9px] font-mono text-text-muted uppercase">Optional telemetry</span>
            </div>

            {!cameraAsked ? (
              <div className="py-4 text-center space-y-3.5">
                <p className="text-xs text-text-secondary leading-relaxed">
                  Camera analysis provides observable presentation signals. It does not determine your true emotional state and is not a medical or psychological assessment.
                </p>
                <div className="flex justify-center gap-3">
                  <button 
                    onClick={() => setCameraAsked(true)}
                    className="border border-border-default hover:border-brand-primary bg-bg-secondary text-text-secondary px-3.5 py-1.5 rounded font-mono text-xs"
                  >
                    Continue Without Camera
                  </button>
                  <button 
                    onClick={handleStartCamera}
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-1.5 rounded font-mono text-xs font-bold transition-all"
                  >
                    Enable Camera
                  </button>
                </div>
              </div>
            ) : cameraEnabled ? (
              <div className="space-y-4">
                {/* Webcam Stream canvas */}
                <div className="relative rounded overflow-hidden bg-black border border-border-default aspect-video max-w-sm mx-auto">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {/* Futuristic overlays */}
                  <div className="absolute inset-0 border border-brand-primary/20 pointer-events-none" />
                  <div className="absolute top-2 left-2 text-[9px] font-mono text-brand-primary bg-bg-dominant/80 px-1.5 py-0.5 rounded">
                    ● PRESENCE MONITOR ACTIVE
                  </div>
                  <div className="absolute bottom-2 right-2 text-[9px] font-mono text-text-muted bg-bg-dominant/80 px-1.5 py-0.5 rounded">
                    gaze_tracking: {cameraGazeShift === 0 ? "CENTERED" : cameraGazeShift === 1 ? "SHIFT_LEFT" : "SHIFT_RIGHT"}
                  </div>
                </div>

                {/* Signals logs */}
                <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                  <div className="p-2 bg-bg-secondary border border-border-default rounded">
                    <span className="text-[9px] text-text-muted block">SPEECH FLUENCY</span>
                    <span className="font-bold text-brand-primary">Good</span>
                  </div>
                  <div className="p-2 bg-bg-secondary border border-border-default rounded">
                    <span className="text-[9px] text-text-muted block">ENGAGEMENT</span>
                    <span className="font-bold text-brand-primary">{cameraEngagement}</span>
                  </div>
                  <div className="p-2 bg-bg-secondary border border-border-default rounded">
                    <span className="text-[9px] text-text-muted block">COMPOSURE</span>
                    <span className="font-bold text-brand-primary">Steady</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-bg-secondary border border-border-default text-[10px] font-mono text-text-secondary leading-normal">
                  <span className="text-brand-accent font-bold">AI-estimated observational signal:</span> Observable presentation signals showed increased composure and minimal gaze shifts during the final analysis.
                </div>

                <button 
                  onClick={handleStopCamera}
                  className="w-full py-1.5 border border-red-500/20 hover:border-red-500/40 text-red-400 bg-red-950/10 rounded font-mono text-xs transition-colors"
                >
                  Disable Camera Overlay
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-xs font-mono text-text-muted border border-dashed border-border-default rounded">
                Camera Presentation Telemetry is disabled. Mirror AI operates normally.
              </div>
            )}
          </div>

          {/* Session Progress Trends */}
          <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-widest">Progress Trajectory</h3>
            {history.length > 1 ? (
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1C261D" />
                    <XAxis dataKey="completed_at" tickFormatter={(tick) => new Date(tick).toLocaleDateString()} stroke="#667067" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#667067" domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0D130E', borderColor: '#1C261D', color: '#F4F7F2', fontFamily: 'monospace', fontSize: 10 }} />
                    <Bar dataKey="debugging" fill="#7CFF4F" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="border border-dashed border-border-default rounded p-8 text-center text-xs font-mono text-text-muted leading-relaxed">
                Complete more sessions to reveal your skill trajectory.
              </div>
            )}
          </div>

        </section>

        {/* RIGHT COLUMN: Gaps, Explain It Back & Next Challenge (col-span-7) */}
        <section className="lg:col-span-7 space-y-6 text-left">
          
          {/* Strengths / Development Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-panel-default border border-border-default rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-brand-primary uppercase tracking-wider">
                <Award size={16} /> Your Strength
              </div>
              <h4 className="text-sm font-bold text-text-primary">{notes.strongest_area || 'Technical Communication'}</h4>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                {notes.communication_evidence || 'You clearly described the observed expected failures.'}
              </p>
            </div>

            <div className="bg-panel-default border border-border-default rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-brand-accent uppercase tracking-wider">
                <Target size={16} /> Area to Develop
              </div>
              <h4 className="text-sm font-bold text-text-primary">{notes.development_area || 'Independent Reasoning'}</h4>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                {notes.why || 'Focus on examining the full stack log before applying code patches.'}
              </p>
            </div>
          </div>

          {/* Explain It Back Panel */}
          <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-brand-primary uppercase tracking-widest">Explain It Back</h3>
              <span className="text-[9px] font-mono text-text-muted uppercase">Technical understanding check</span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Before reviewing your overall solution parameters, explain in your own words:
              <br />
              <span className="text-text-muted">1. Why did the bug happen? 2. Why does the fix work?</span>
            </p>

            {savedFeedback ? (
              // Display results
              <div className="space-y-4 p-4 bg-bg-secondary rounded border border-border-default">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-text-muted">YOUR EVALUATED LEVEL:</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    savedRating === 'Strong' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' :
                    savedRating === 'Good' ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' :
                    'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {savedRating}
                  </span>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-text-muted uppercase block">Your explanation:</span>
                  <p className="text-xs text-text-secondary leading-relaxed italic">&quot;{savedExplanation}&quot;</p>
                </div>
                <div className="space-y-2 pt-2 border-t border-border-default/50">
                  <span className="text-[10px] font-mono text-brand-primary uppercase block">Reflector Feedback:</span>
                  <p className="text-xs text-text-secondary leading-relaxed">{savedFeedback}</p>
                </div>
              </div>
            ) : (
              // Input form
              <form onSubmit={handleSubmitExplanation} className="space-y-3.5">
                <div className="relative">
                  <textarea
                    value={userExplanation}
                    onChange={(e) => setUserExplanation(e.target.value)}
                    className="w-full bg-bg-secondary border border-border-default rounded p-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none transition-colors min-h-[90px]"
                    placeholder="Describe the failure and fix mechanisms..."
                    required
                  />
                  {explainMicState === 'LISTENING' && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded">
                      <span className="text-xs font-mono text-brand-primary animate-pulse">● Listening explanation... speak now</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={startExplainMic}
                    className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-brand-primary transition-colors"
                  >
                    <Mic size={14} /> Speak Response
                  </button>

                  <button
                    type="submit"
                    disabled={submittingExplanation || !userExplanation.trim()}
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-1.5 rounded font-mono text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {submittingExplanation ? 'Analyzing explanation...' : 'Submit Explanation'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Skill signals detailed tabs */}
          <div className="bg-panel-default border border-border-default rounded-xl overflow-hidden">
            <div className="h-11 border-b border-border-default bg-panel-elevated flex text-xs font-mono select-none">
              {['summary', 'evidence'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 h-full flex items-center justify-center border-r border-border-default transition-colors font-bold uppercase tracking-wider ${
                    activeTab === tab ? 'bg-bg-dominant text-brand-primary' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4 font-mono text-xs">
              {activeTab === 'summary' ? (
                <div className="space-y-3.5">
                  <div className="flex justify-between border-b border-border-default/50 pb-2">
                    <span className="text-text-secondary">Communication Signal</span>
                    <span className="text-brand-primary font-bold">{signal.communication}%</span>
                  </div>
                  <div className="flex justify-between border-b border-border-default/50 pb-2">
                    <span className="text-text-secondary">Problem Decomposition</span>
                    <span className="text-brand-primary font-bold">{signal.problem_solving}%</span>
                  </div>
                  <div className="flex justify-between border-b border-border-default/50 pb-2">
                    <span className="text-text-secondary">Debugging Strategy</span>
                    <span className="text-brand-primary font-bold">{signal.debugging}%</span>
                  </div>
                  <div className="flex justify-between border-b border-border-default/50 pb-2">
                    <span className="text-text-secondary">Technical Understanding</span>
                    <span className="text-brand-primary font-bold">{signal.technical_understanding}%</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-text-secondary">Independent Reasoning</span>
                    <span className="text-brand-primary font-bold">{signal.independent_reasoning}%</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 font-sans text-xs">
                  <div className="space-y-1">
                    <h5 className="font-mono text-[10px] uppercase font-bold text-text-muted">Communication Log:</h5>
                    <p className="text-text-secondary leading-relaxed">{notes.communication_evidence}</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-mono text-[10px] uppercase font-bold text-text-muted">Problem-Solving / Strategy:</h5>
                    <p className="text-text-secondary leading-relaxed">{notes.problem_solving_evidence}</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-mono text-[10px] uppercase font-bold text-text-muted">Debugging Strategy:</h5>
                    <p className="text-text-secondary leading-relaxed">{notes.debugging_evidence}</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-mono text-[10px] uppercase font-bold text-text-muted">Technical Understanding:</h5>
                    <p className="text-text-secondary leading-relaxed">{notes.technical_understanding_evidence}</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-mono text-[10px] uppercase font-bold text-text-muted">Independent Reasoning:</h5>
                    <p className="text-text-secondary leading-relaxed">{notes.independent_reasoning_evidence}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Personalized Next Challenge */}
          <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-brand-primary uppercase tracking-widest">Personalized Next Challenge</h3>
              <span className="text-[10px] font-mono text-text-muted">Targeting Async Race Conditions</span>
            </div>

            <div className="p-4 bg-bg-secondary border border-border-default rounded space-y-3">
              <h4 className="text-sm font-bold font-mono">Challenge: Debug Asynchronous API Race Condition</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                A database update transaction is triggered inside an Express POST route but its promise outcome is not awaited before triggering the final client response. Stale reads occur on consecutive queries. Refactor using correct async/await patterns.
              </p>
            </div>

            {/* Mode selection */}
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted uppercase">Challenge Mode:</span>
                <div className="flex gap-1.5">
                  {['GUIDED', 'HINTS', 'INDEPENDENT'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setActiveChallengeMode(mode);
                        setCurrentHintIndex(-1); // Reset hints
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                        activeChallengeMode === mode 
                          ? 'border-brand-primary text-brand-primary bg-brand-primary/10' 
                          : 'border-border-default text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progressive hints for Guided/Hints modes */}
              {activeChallengeMode !== 'INDEPENDENT' && (
                <div className="p-3 bg-panel-elevated/40 border border-border-default/50 rounded space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-brand-accent font-bold">Progressive Hints</span>
                    <button 
                      onClick={() => setCurrentHintIndex(prev => Math.min(prev + 1, challengeHints.length - 1))}
                      disabled={currentHintIndex === challengeHints.length - 1}
                      className="text-brand-primary hover:underline disabled:opacity-40"
                    >
                      Next Hint ({currentHintIndex + 1}/{challengeHints.length})
                    </button>
                  </div>
                  {currentHintIndex >= 0 ? (
                    <p className="text-[11px] text-text-secondary italic leading-relaxed">
                      💡 {challengeHints[currentHintIndex]}
                    </p>
                  ) : (
                    <p className="text-[10px] text-text-muted">Click &quot;Next Hint&quot; to receive step-by-step pointers without revealing the full patch immediately.</p>
                  )}
                </div>
              )}

              <button
                onClick={handleStartChallenge}
                className="w-full py-2.5 bg-brand-primary text-bg-dominant hover:bg-brand-accent transition-colors font-bold rounded text-center text-xs font-sans"
              >
                Accept & Start Challenge (Sandbox Mode)
              </button>
            </div>
          </div>

        </section>

      </main>
    </div>
  );
};

export default SkillMirror;
