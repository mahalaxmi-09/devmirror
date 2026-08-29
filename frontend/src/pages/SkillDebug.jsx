import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mic, CheckCircle2, Play, Terminal as TermIcon, FileCode, Check, 
  AlertCircle, AlertTriangle, ArrowRight, X, Upload, Image, 
  Code, Eye, FolderPlus, ArrowLeft, RefreshCw, Lock, HelpCircle 
} from 'lucide-react';
import api from '../utils/api';
import Waveform from '../components/Waveform';

const SkillDebug = () => {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const [mission, setMission] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Workspace core states
  const [micState, setMicState] = useState('READY'); // READY, LISTENING, PROCESSING, TRANSCRIBING, READY FOR REVIEW
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const recognitionRef = useRef(null);

  // Evidence states for new mission landing screen
  const [selectedProjectZip, setSelectedProjectZip] = useState(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState('');
  
  // Custom Code Editor states
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorTab, setEditorTab] = useState('CODE'); // CODE, ERROR LOG, DESCRIPTION
  const [editorLanguage, setEditorLanguage] = useState('Auto Detect');
  const [pastedCode, setPastedCode] = useState('');
  const [pastedErrorLog, setPastedErrorLog] = useState('');

  // Voice/Text input states
  const [typedProblemText, setTypedProblemText] = useState('');
  const [pastedDescription, setPastedDescription] = useState('');
  const [inputMode, setInputMode] = useState(''); // 'voice' or 'text'

  // Instant code debugger states
  const [activeTab, setActiveTab] = useState('AUTONOMOUS'); // 'AUTONOMOUS' | 'INSTANT'
  const [instantCode, setInstantCode] = useState('');
  const [instantLanguage, setInstantLanguage] = useState('javascript');
  const [instantError, setInstantError] = useState('');
  const [instantContext, setInstantContext] = useState('');
  const [instantResult, setInstantResult] = useState(null);
  const [instantLoading, setInstantLoading] = useState(false);
  const [instantErrorMsg, setInstantErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSolveInstantBug = async () => {
    if (!instantCode.trim()) {
      alert('Please paste some code to debug.');
      return;
    }
    setInstantLoading(true);
    setInstantErrorMsg('');
    setInstantResult(null);
    try {
      const response = await api.post('/debug/run', {
        code: instantCode,
        language: instantLanguage,
        error: instantError,
        context: instantContext
      });
      setInstantResult(response.data);
    } catch (err) {
      console.error(err);
      setInstantErrorMsg(err.response?.data?.error || err.message || 'An error occurred during debugging.');
    } finally {
      setInstantLoading(false);
    }
  };

  // Active mission running states
  const [diagnosis, setDiagnosis] = useState(null);
  const [patchApplied, setPatchApplied] = useState(false);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  // File input references
  const projectInputRef = useRef(null);
  const screenshotInputRef = useRef(null);

  useEffect(() => {
    // Check Speech Recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setMicState('LISTENING');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setMicState('READY FOR REVIEW');
      };

      rec.onerror = (e) => {
        console.error('Speech error:', e);
        setMicState('READY');
      };

      rec.onend = () => {
        if (micState === 'LISTENING') setMicState('READY');
      };

      recognitionRef.current = rec;
    }
  }, [micState]);

  // Load existing mission if ID is present
  useEffect(() => {
    const loadMissionDetails = async () => {
      if (!missionId) {
        setMission(null);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get(`/missions/${missionId}`);
        setMission(response.data);
        
        if (response.data.files && response.data.files.length > 0) {
          setSelectedFile(response.data.files[0]);
        }

        if (response.data.status === 'VERIFIED_FIXED') {
          setPatchApplied(true);
          const passedRun = response.data.test_runs.find(r => r.status === 'PASSED');
          if (passedRun) {
            setSandboxResult({ success: true, exitCode: 0 });
            setTerminalOutput(`$ npm test\n\n${passedRun.stdout}\n\nProcess exited with code 0`);
          }
        }
      } catch (err) {
        console.error('Failed to load mission:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMissionDetails();
  }, [missionId]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Microphone access is unavailable. You can continue by typing your problem.');
      return;
    }
    
    if (micState === 'LISTENING') {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setMicState('LISTENING');
      recognitionRef.current.start();
    }
  };

  const handleProjectSelected = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedProjectZip(file);
    }
  };

  const handleScreenshotSelected = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedScreenshot(file);
      setScreenshotPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Launch a new debugging session
  const handleLaunchInvestigation = async () => {
    setLoading(true);
    try {
      // 1. Create base mission with exact data models
      const missionRes = await api.post('/missions', {
        voice_transcript: transcript,
        problem_description: pastedDescription,
        input_mode: inputMode,
        language: editorLanguage === 'Auto Detect' ? 'javascript' : editorLanguage.toLowerCase()
      });
      const missionData = missionRes.data;

      // 2. Upload Project ZIP if selected
      if (selectedProjectZip) {
        const formData = new FormData();
        formData.append('file', selectedProjectZip);
        await api.post(`/missions/${missionData.id}/upload-evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // 3. Upload Screenshot if selected
      if (selectedScreenshot) {
        const formData = new FormData();
        formData.append('file', selectedScreenshot);
        await api.post(`/missions/${missionData.id}/upload-evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // 4. Upload Pasted Code if present
      if (pastedCode.trim()) {
        const fileExt = editorLanguage === 'Python' ? 'main.py' : 'index.js';
        await api.post(`/missions/${missionData.id}/files`, {
          filename: fileExt,
          file_content: pastedCode
        });
      }

      // 5. Upload Error Log if present
      if (pastedErrorLog.trim()) {
        await api.post(`/missions/${missionData.id}/files`, {
          filename: 'error.log',
          file_content: pastedErrorLog
        });
      }

      // 6. Trigger AI investigation and root-cause analysis
      await api.post(`/missions/${missionData.id}/analyze`);

      // 7. Route user to active debugging workspace
      navigate(`/debug/${missionData.id}`);
    } catch (err) {
      alert('Failed to launch investigation: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Applied patches trigger in sandbox
  const handleApplyToSandbox = async () => {
    if (!mission) return;
    setLoading(true);
    setTerminalOutput('$ npm test\nApplying patch and executing tests in isolated sandbox...');
    try {
      const response = await api.post(`/missions/${mission.id}/debug`);
      setSandboxResult(response.data);
      setTerminalOutput(`$ npm test\n\n${response.data.stdout}\n${response.data.stderr}\n\nProcess exited with code ${response.data.exitCode}`);
      
      if (response.data.success) {
        setPatchApplied(true);
        // Refresh mission state
        const updatedRes = await api.get(`/missions/${mission.id}`);
        setMission(updatedRes.data);
      }
    } catch (err) {
      setTerminalOutput(`$ npm test\n\nExecution Failure: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Verification pipeline indicators
  const getStepStatus = (stepIndex) => {
    if (!mission) return 'pending';
    const status = mission.status;

    if (stepIndex === 1) return 'completed'; // Listen
    if (stepIndex === 2) return 'completed'; // Collect
    if (stepIndex === 3) {
      return (status !== 'INVESTIGATING') ? 'completed' : 'active';
    }
    if (stepIndex === 4) {
      return (status === 'PATCH_GENERATED' || status === 'VERIFIED_FIXED') ? 'completed' : (status === 'FAILED' ? 'failed' : 'pending');
    }
    if (stepIndex === 5) {
      return (status === 'PATCH_GENERATED' || status === 'VERIFIED_FIXED') ? 'completed' : 'pending';
    }
    if (stepIndex === 6) {
      return (status === 'VERIFIED_FIXED') ? 'completed' : (status === 'PATCH_GENERATED' && loading ? 'active' : 'pending');
    }
    if (stepIndex === 7) {
      return (status === 'VERIFIED_FIXED') ? 'completed' : 'pending';
    }
    return 'pending';
  };

  // Helper validation: Do we have source code files or project archive to debug?
  const hasCodeEvidence = !!(selectedProjectZip || pastedCode.trim());
  const hasDescription = !!pastedDescription.trim();
  const hasEnoughEvidence = hasCodeEvidence && hasDescription;

  // RENDER LANDING SETUP SCREEN
  if (!missionId) {
    return (
      <div className="min-h-screen bg-bg-dominant text-text-primary p-6 lg:p-10 font-sans flex flex-col justify-between">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          
          {/* Header */}
          <div className="border-b border-border-default pb-6 text-left">
            <a href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-text-primary mb-4 transition-colors">
              <ArrowLeft size={14} /> Back to Dashboard
            </a>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">SKILLDEBUG</h1>
                <p className="text-sm text-text-secondary font-mono mt-1">“Tell me what’s wrong. Give me the evidence. I’ll investigate.”</p>
              </div>
              
              {/* Tab Selector */}
              <div className="flex border border-border-default rounded overflow-hidden font-mono text-xs select-none">
                <button
                  onClick={() => setActiveTab('AUTONOMOUS')}
                  className={`px-4 py-2 border-r border-border-default transition-all ${
                    activeTab === 'AUTONOMOUS' ? 'bg-brand-primary text-bg-dominant font-bold' : 'text-text-secondary hover:bg-panel-default'
                  }`}
                >
                  🤖 Autonomous Mission
                </button>
                <button
                  onClick={() => setActiveTab('INSTANT')}
                  className={`px-4 py-2 transition-all ${
                    activeTab === 'INSTANT' ? 'bg-brand-primary text-bg-dominant font-bold' : 'text-text-secondary hover:bg-panel-default'
                  }`}
                >
                  ⚡ Instant Code Repair
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'AUTONOMOUS' ? (
            <div className="space-y-6 text-left">
              <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-brand-primary"># What are you debugging?</h2>
            
            {/* 4 Input Methods Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Method 1: Voice */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-brand-primary/50 transition-colors">
                <div className="space-y-2">
                  <span className="text-sm font-bold block">🎙️ VOICE DEBUG</span>
                  <p className="text-xs text-text-secondary leading-relaxed">Explain the problem naturally. Let us transcribe and understand.</p>
                </div>
                <div className="space-y-3">
                  {micState === 'LISTENING' && <Waveform state="LISTENING" />}
                  {transcript && !isEditingTranscript && (
                    <div className="p-2.5 bg-bg-secondary rounded border border-border-default text-[10px] text-text-secondary max-h-[80px] overflow-y-auto">
                      "{transcript}"
                    </div>
                  )}
                  {isEditingTranscript && (
                    <textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded p-2 text-[10px] text-text-primary focus:outline-none"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={toggleRecording}
                      className={`flex-grow py-2 rounded font-bold text-xs font-mono transition-all ${
                        micState === 'LISTENING'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-brand-primary text-bg-dominant hover:bg-brand-accent'
                      }`}
                    >
                      {micState === 'LISTENING' ? 'Stop Rec' : 'Start Voice Debug'}
                    </button>
                    {transcript && (
                      <button 
                        onClick={() => {
                          setPastedDescription(transcript.trim());
                          setInputMode('voice');
                        }}
                        className="bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 px-3 py-1.5 rounded text-[10px] font-mono"
                      >
                        Use Transcript
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Method 2: Upload Project */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-brand-primary/50 transition-colors">
                <div className="space-y-2">
                  <span className="text-sm font-bold block">📁 UPLOAD PROJECT</span>
                  <p className="text-xs text-text-secondary leading-relaxed">Upload project archive so SkillDebug can scan the actual source.</p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={projectInputRef}
                    onChange={handleProjectSelected}
                    accept=".zip,.tar,.tar.gz"
                    className="hidden"
                  />
                  {selectedProjectZip ? (
                    <div className="p-3 bg-bg-secondary border border-border-default rounded space-y-2 text-xs text-left mb-2">
                      <div className="font-bold text-brand-primary truncate">{selectedProjectZip.name}</div>
                      <div className="text-[10px] text-text-muted">
                        {Math.round(selectedProjectZip.size / 1024 * 100) / 100} KB
                      </div>
                      <button
                        onClick={() => setSelectedProjectZip(null)}
                        className="text-[10px] text-red-400 hover:underline block"
                      >
                        [Remove]
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => projectInputRef.current?.click()}
                      className="w-full py-2 border border-border-default bg-bg-secondary text-text-secondary hover:text-text-primary rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Upload size={14} /> Upload Project
                    </button>
                  )}
                </div>
              </div>

              {/* Method 3: Screenshot */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-brand-primary/50 transition-colors">
                <div className="space-y-2">
                  <span className="text-sm font-bold block">🖼️ SCREENSHOT / IMAGE</span>
                  <p className="text-xs text-text-secondary leading-relaxed">Attach terminal console logs, error states, or rendering issues.</p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={screenshotInputRef}
                    onChange={handleScreenshotSelected}
                    accept="image/*"
                    className="hidden"
                  />
                  {selectedScreenshot ? (
                    <div className="space-y-2 text-xs">
                      <img 
                        src={screenshotPreviewUrl} 
                        alt="Screenshot Preview" 
                        className="w-full h-16 object-cover border border-border-default rounded"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => screenshotInputRef.current?.click()}
                          className="text-[10px] text-brand-primary hover:underline"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => { setSelectedScreenshot(null); setScreenshotPreviewUrl(''); }}
                          className="text-[10px] text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => screenshotInputRef.current?.click()}
                      className="w-full py-2 border border-border-default bg-bg-secondary text-text-secondary hover:text-text-primary rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Image size={14} /> Upload Image
                    </button>
                  )}
                </div>
              </div>

              {/* Method 4: Paste Code */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-brand-primary/50 transition-colors">
                <div className="space-y-2">
                  <span className="text-sm font-bold block">{"</>"} PASTE CODE OR TEXT</span>
                  <p className="text-xs text-text-secondary leading-relaxed">Paste stack traces, code files, configuration files directly.</p>
                </div>
                <div>
                  <button
                    onClick={() => setShowEditorModal(true)}
                    className="w-full py-2 border border-border-default bg-bg-secondary text-text-secondary hover:text-text-primary rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Code size={14} /> Open Editor
                  </button>
                  {pastedCode && (
                    <div className="text-[10px] text-brand-primary text-center mt-2 font-mono">
                      ✓ Paste editor configured
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Text input description form alternative */}
            <div className="bg-panel-default border border-border-default rounded-xl p-6 text-left space-y-4">
              <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-primary">OR TYPE YOUR PROBLEM</h3>
              
              <div className="space-y-2">
                <label className="block text-xs font-mono text-text-secondary uppercase">
                  Problem description <span className="text-brand-primary font-bold">*</span>
                </label>
                <textarea
                  value={typedProblemText}
                  onChange={(e) => setTypedProblemText(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded p-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none min-h-[100px] font-sans"
                  placeholder="Describe what is going wrong, what you expected to happen, and what actually happened…"
                />
              </div>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (typedProblemText.trim() === '') {
                    alert('Please describe the problem before continuing.');
                    return;
                  }
                  setPastedDescription(typedProblemText.trim());
                  setInputMode('text');
                }}
                className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-2 rounded font-sans text-xs font-bold transition-all shadow-green-glow"
              >
                Continue with Text
              </button>
            </div>

            {/* Evidence Checklist Summary Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
              
              <div className="lg:col-span-2 bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider"># Mission Evidence</h3>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  {pastedDescription && (
                    <div className="flex items-center gap-2">
                      <span className="text-brand-primary">✓</span>
                      <span className="text-text-secondary">Problem description</span>
                    </div>
                  )}
                  {inputMode === 'voice' && transcript && (
                    <div className="flex items-center gap-2">
                      <span className="text-brand-primary">✓</span>
                      <span className="text-text-secondary">Voice transcript</span>
                    </div>
                  )}
                  {selectedProjectZip && (
                    <div className="flex items-center gap-2">
                      <span className="text-brand-primary">✓</span>
                      <span className="text-text-secondary">Project ZIP</span>
                    </div>
                  )}
                  {selectedScreenshot && (
                    <div className="flex items-center gap-2">
                      <span className="text-brand-primary">✓</span>
                      <span className="text-text-secondary">Screenshot/Image</span>
                    </div>
                  )}
                  {pastedCode.trim() && (
                    <div className="flex items-center gap-2">
                      <span className="text-brand-primary">✓</span>
                      <span className="text-text-secondary">Pasted code</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border-default/50 pt-4 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-text-muted block">Evidence Check</span>
                    {hasEnoughEvidence ? (
                      <span className="text-xs font-bold text-brand-primary flex items-center gap-1.5 mt-0.5">
                        ● EVIDENCE READY
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5 mt-0.5">
                        ● NEED MORE EVIDENCE
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleLaunchInvestigation}
                    disabled={loading || !hasEnoughEvidence}
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-6 py-2.5 rounded font-sans text-xs font-bold transition-all shadow-green-glow disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {loading ? 'Launching Debug Agent...' : 'Start Investigation'} <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-panel-default border border-border-default rounded-xl p-6 flex flex-col justify-center space-y-2">
                <span className="text-xs font-bold text-text-primary">Important Requirement</span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  We need source code modules or a project archive to run analysis. Please make sure to attach code via <b>Upload Project</b> or by pasting it inside <b>Open Editor</b>.
                </p>
              </div>

            </div>

          </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
              
              {/* Left Column: Inputs */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-panel-default border border-border-default rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-brand-primary">⚡ Code Repair Terminal</h3>
                  
                  <div className="space-y-1.5 font-mono text-xs">
                    <label className="block text-text-secondary">PROGRAMMING LANGUAGE</label>
                    <select 
                      value={instantLanguage}
                      onChange={(e) => setInstantLanguage(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default text-text-secondary rounded px-3 py-2 focus:border-brand-primary focus:outline-none"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="go">Go</option>
                      <option value="rust">Rust</option>
                      <option value="typescript">TypeScript</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    <label className="block text-text-secondary">PASTE BROKEN CODE *</label>
                    <textarea
                      value={instantCode}
                      onChange={(e) => setInstantCode(e.target.value)}
                      className="w-full bg-[#050705] border border-border-default rounded p-3 text-[#F4F7F2] font-mono focus:border-brand-primary focus:outline-none min-h-[160px]"
                      placeholder="// Paste your buggy code block here..."
                      required
                    />
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    <label className="block text-text-secondary">ERROR LOG / SYMPTOMS (OPTIONAL)</label>
                    <textarea
                      value={instantError}
                      onChange={(e) => setInstantError(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded p-3 text-red-300 font-mono focus:border-brand-primary focus:outline-none min-h-[90px]"
                      placeholder="Paste stack traces or error logs..."
                    />
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    <label className="block text-text-secondary">CONTEXT / INSTRUCTIONS (OPTIONAL)</label>
                    <textarea
                      value={instantContext}
                      onChange={(e) => setInstantContext(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded p-3 text-text-secondary font-mono focus:border-brand-primary focus:outline-none min-h-[70px]"
                      placeholder="Explain what this code is supposed to do..."
                    />
                  </div>

                  <button
                    onClick={handleSolveInstantBug}
                    disabled={instantLoading || !instantCode.trim()}
                    className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-2.5 rounded font-sans text-xs font-bold transition-all shadow-green-glow disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {instantLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Analyzing & Verifying...
                      </>
                    ) : (
                      <>
                        <span>Solve Code Bug</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Results */}
              <div className="lg:col-span-7">
                {instantLoading && (
                  <div className="bg-panel-default border border-border-default rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                    <RefreshCw size={24} className="text-brand-primary animate-spin" />
                    <span className="text-sm font-mono text-brand-primary animate-pulse uppercase tracking-wider font-bold">AI Analyzing & Verifying Fix in Sandbox...</span>
                    <p className="text-xs text-text-secondary max-w-sm leading-relaxed">
                      Our autonomous agent is running tests, applying patches, and checking outcomes in our secure execution environment. This will take up to 10 seconds.
                    </p>
                  </div>
                )}

                {instantErrorMsg && (
                  <div className="bg-panel-default border border-red-500/30 rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3 text-red-400">
                      <AlertCircle size={20} className="shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm">System Error Occurred</h4>
                        <p className="text-xs text-text-secondary mt-1">{instantErrorMsg}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setInstantErrorMsg('')}
                      className="px-4 py-2 border border-border-default hover:bg-bg-secondary rounded text-xs font-mono text-text-secondary"
                    >
                      Clear Error
                    </button>
                  </div>
                )}

                {instantResult && (
                  <div className="space-y-6">
                    {/* Status Banner */}
                    {instantResult.success ? (
                      <div className="bg-brand-primary/10 border border-brand-primary/30 text-brand-accent p-4 rounded-xl flex items-start gap-3">
                        <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-brand-primary" />
                        <div>
                          <h4 className="font-bold text-sm">Verification Succeeded</h4>
                          <p className="text-xs text-text-secondary mt-1">
                            The code was modified and compiled successfully inside the sandbox environment without reporting errors.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-4 rounded-xl flex items-start gap-3">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-sm">Verification Failed / Unverified</h4>
                          <p className="text-xs text-text-secondary mt-1">
                            We generated a patch, but execution failed in the sandbox validation test with error: <b>{instantResult.error || 'Unknown runtime error'}</b>.
                          </p>
                        </div>
                      </div>
                    )}

                     {/* Explanations */}
                    <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
                      {instantResult.diagnosis ? (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-widest">Sandbox Execution Diagnosis</span>
                          <pre className="text-xs leading-relaxed text-text-secondary whitespace-pre-wrap font-sans mt-2 bg-bg-secondary border border-border-default/40 p-4 rounded-lg select-text">
                            {instantResult.diagnosis}
                          </pre>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-widest">Root Cause</span>
                            <p className="text-xs leading-relaxed text-text-primary">{instantResult.rootCause}</p>
                          </div>
                          <div className="border-t border-border-default/50 pt-3.5 space-y-1">
                            <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-widest">Resolution Explanation</span>
                            <p className="text-xs leading-relaxed text-text-secondary">{instantResult.explanation}</p>
                          </div>
                          {instantResult.changes && instantResult.changes.length > 0 && (
                            <div className="border-t border-border-default/50 pt-3.5 space-y-1">
                              <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-widest">Applied Changes</span>
                              <ul className="list-disc list-inside text-xs text-text-secondary space-y-1 font-mono">
                                {instantResult.changes.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Fixed Code Blocks */}
                    <div className="bg-[#050705] border border-border-default rounded-xl overflow-hidden">
                      <div className="bg-panel-default px-4 py-2 border-b border-border-default flex justify-between items-center text-xs font-mono select-none">
                        <span className="text-text-secondary font-bold font-mono">Fixed Code Output</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(instantResult.fixedCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="px-2.5 py-1 border border-border-default bg-bg-secondary hover:border-brand-primary text-text-secondary hover:text-brand-primary transition-all rounded text-[10px] font-bold"
                        >
                          {copied ? '✓ Copied' : 'Copy Code'}
                        </button>
                      </div>
                      <div className="p-4 overflow-y-auto max-h-[300px] text-left font-mono text-[11px] leading-relaxed text-[#F4F7F2] select-text">
                        <pre>{instantResult.fixedCode}</pre>
                      </div>
                    </div>
                  </div>
                )}

                {!instantLoading && !instantResult && !instantErrorMsg && (
                  <div className="bg-panel-default border border-border-default/60 border-dashed rounded-xl p-16 text-center text-xs font-mono text-text-muted select-none flex flex-col items-center justify-center space-y-2">
                    <Code size={24} className="text-text-muted/65" />
                    <span>Bug diagnosis report console.</span>
                    <p className="text-[10px] text-text-muted/70 max-w-xs font-sans leading-normal">
                      Pasted code results and sandbox telemetry analysis will render here once you execute the solver.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Professional Editor Modal */}
        {showEditorModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-panel-default border border-border-default max-w-2xl w-full rounded-xl p-6 space-y-4 text-left">
              
              <div className="flex justify-between items-center border-b border-border-default pb-3.5 select-none">
                <span className="font-bold text-text-primary font-mono text-xs uppercase tracking-wider">Paste Editor Console</span>
                <button onClick={() => setShowEditorModal(false)} className="text-text-secondary hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>

              <div className="flex justify-between items-center gap-4 text-xs font-mono select-none">
                <div className="flex border border-border-default rounded overflow-hidden">
                  <button 
                    onClick={() => setEditorTab('CODE')}
                    className={`px-3 py-1.5 border-r border-border-default ${editorTab === 'CODE' ? 'bg-bg-secondary text-brand-primary' : 'text-text-secondary'}`}
                  >
                    CODE
                  </button>
                  <button 
                    onClick={() => setEditorTab('ERROR LOG')}
                    className={`px-3 py-1.5 border-r border-border-default ${editorTab === 'ERROR LOG' ? 'bg-bg-secondary text-brand-primary' : 'text-text-secondary'}`}
                  >
                    ERROR LOG
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-[10px]">LANGUAGE:</span>
                  <select 
                    value={editorLanguage}
                    onChange={(e) => setEditorLanguage(e.target.value)}
                    className="bg-bg-secondary border border-border-default text-text-secondary rounded px-2 py-1 focus:outline-none"
                  >
                    <option>Auto Detect</option>
                    <option>JavaScript</option>
                    <option>TypeScript</option>
                    <option>Python</option>
                    <option>Go</option>
                    <option>Rust</option>
                  </select>
                </div>
              </div>

              {/* Editor Workspace Textarea styling with line numbers */}
              <div className="grid grid-cols-12 gap-2 border border-border-default rounded bg-[#050705] p-3 text-xs leading-relaxed font-mono">
                {editorTab === 'CODE' && (
                  <>
                    <div className="col-span-1 text-right text-text-muted select-none opacity-45 pr-2 border-r border-border-default">
                      {(pastedCode.split('\n').length || 1) > 0 && Array.from({ length: pastedCode.split('\n').length || 1 }).map((_, i) => (
                        <div key={i}>{i+1}</div>
                      ))}
                    </div>
                    <textarea
                      value={pastedCode}
                      onChange={(e) => setPastedCode(e.target.value)}
                      className="col-span-11 bg-transparent text-[#F4F7F2] focus:outline-none min-h-[220px] resize-y placeholder-text-muted/40 font-mono"
                      placeholder="// Paste your source code here..."
                    />
                  </>
                )}

                {editorTab === 'ERROR LOG' && (
                  <textarea
                    value={pastedErrorLog}
                    onChange={(e) => setPastedErrorLog(e.target.value)}
                    className="col-span-12 bg-transparent text-red-300 focus:outline-none min-h-[220px] resize-y placeholder-text-muted/40 font-mono"
                    placeholder="Paste terminal exception logs or stack traces here..."
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 select-none">
                <button
                  onClick={() => setShowEditorModal(false)}
                  className="px-4 py-2 border border-border-default rounded hover:bg-bg-secondary text-xs text-text-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowEditorModal(false)}
                  className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-2 rounded text-xs font-bold transition-colors"
                >
                  Save Changes
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // RENDER WORKSPACE THREE-COLUMN LAYOUT IF missionId IS PRESENT
  if (loading && !mission) {
    return (
      <div className="min-h-screen bg-bg-dominant flex items-center justify-center font-mono text-xs text-text-muted animate-pulse">
        Initializing Debugging Workspace...
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-bg-dominant flex items-center justify-center font-mono text-xs text-red-400">
        ✕ Mission session not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dominant flex flex-col text-text-primary overflow-hidden font-sans">
      
      {/* Header */}
      <header className="h-14 border-b border-border-default px-6 flex items-center justify-between bg-bg-secondary select-none">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="flex items-center gap-1.5 text-xs font-mono text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft size={14} /> Dashboard
          </a>
          <div className="h-4 w-[1px] bg-border-default" />
          <span className="text-xs font-mono font-bold text-brand-primary">DEVMIRROR / WORKSPACE / SKILLDEBUG</span>
          <span className="text-[10px] font-mono text-text-muted">({mission.language})</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-text-muted">MISSION #DM-{mission.id}</span>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border-default bg-panel-default">
            <span className={`w-1.5 h-1.5 rounded-full ${mission.status === 'VERIFIED_FIXED' ? 'bg-brand-primary' : 'bg-yellow-500 animate-pulse'}`} />
            <span className="text-[10px] font-mono text-text-secondary uppercase">{mission.status}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Panels Frame */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-3.5rem)]">
        
        {/* COLUMN 1: PROJECT EXPLORER (col-span-2) */}
        <aside className="lg:col-span-2 bg-bg-secondary border-r border-border-default flex flex-col justify-between overflow-y-auto">
          <div className="p-4 space-y-6 text-left">
            <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-widest block">Project Explorer</span>
            
            <div className="space-y-1.5">
              {mission.files && mission.files.length > 0 ? (
                mission.files.map((file) => (
                  <div 
                    key={file.id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded text-xs font-mono transition-colors cursor-pointer group ${
                      selectedFile?.id === file.id 
                        ? 'bg-panel-default text-brand-primary border border-border-default' 
                        : 'text-text-secondary hover:bg-panel-default/50 hover:text-text-primary'
                    }`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <span className="truncate flex items-center gap-2">
                      <FileCode size={14} className={selectedFile?.id === file.id ? 'text-brand-primary' : 'text-text-muted'} />
                      {file.filename}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-text-muted font-mono p-4 border border-dashed border-border-default text-center rounded">
                  No source files uploaded.
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border-default space-y-3 bg-panel-default/20 text-left">
            <h4 className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">Provide Evidence</h4>
            <p className="text-[10px] text-text-muted leading-relaxed font-sans">
              SkillDebug analyzes the source directories, identifies target dependencies and tests to trace issues.
            </p>
          </div>
        </aside>

        {/* COLUMN 2: CODE VIEWER (col-span-6) */}
        <section className="lg:col-span-6 flex flex-col justify-between border-r border-border-default overflow-hidden">
          <div className="h-10 border-b border-border-default bg-panel-default px-4 flex items-center justify-between text-xs font-mono select-none">
            <span className="text-text-secondary font-bold">{selectedFile ? selectedFile.filename : 'No File Selected'}</span>
            {selectedFile && !selectedFile.is_original && (
              <span className="text-[9px] text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-1 rounded">
                Patched
              </span>
            )}
          </div>

          {/* Code panel editor content */}
          <div className="flex-grow bg-bg-dominant p-4 overflow-y-auto font-mono text-xs leading-relaxed text-text-primary text-left select-text">
            {selectedFile ? (
              mission.status === 'PATCH_GENERATED' && mission.changes && mission.changes[0]?.filename === selectedFile.filename && !patchApplied ? (
                <div className="space-y-4">
                  <div className="p-3.5 bg-yellow-950/20 border border-yellow-500/25 rounded text-[11px] text-yellow-400 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">Proposed Patch generated:</span>
                      <p className="mt-1 text-text-secondary leading-normal">The agent identified target bug lines and recommends applying this code fix.</p>
                    </div>
                  </div>
                  
                  {/* Before / After Diff preview */}
                  <div className="border border-border-default rounded overflow-hidden">
                    <div className="bg-panel-default px-3 py-1.5 border-b border-border-default text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                      Proposed Diff Preview
                    </div>
                    <div className="p-3 bg-bg-secondary text-[11px] space-y-0.5 overflow-x-auto">
                      <div className="diff-removed px-2 py-1 text-red-400">
                        - {mission.changes[0].before_content}
                      </div>
                      <div className="diff-added px-2 py-1 text-brand-primary">
                        + {mission.changes[0].after_content}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-1 text-right text-text-muted select-none text-[10px] space-y-1 opacity-50 pr-2 border-r border-border-default">
                    {selectedFile.file_content.split('\n').map((_, idx) => (
                      <div key={idx}>{idx + 1}</div>
                    ))}
                  </div>
                  <pre className="col-span-11 overflow-x-auto whitespace-pre pr-4 text-text-primary text-[11px] space-y-1 font-mono">
                    {selectedFile.file_content.split('\n').map((line, idx) => (
                      <div key={idx}>{line || ' '}</div>
                    ))}
                  </pre>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted font-mono text-[11px]">
                No files loaded in viewer.
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="h-16 border-t border-border-default bg-bg-secondary px-6 flex items-center justify-between select-none">
            {mission.status === 'PATCH_GENERATED' && !patchApplied ? (
              <div className="flex items-center gap-3 w-full justify-between">
                <span className="text-[11px] text-text-secondary font-mono">
                  Agent patch ready for execution.
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={handleApplyToSandbox}
                    disabled={loading}
                    className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-2 rounded font-mono text-xs font-bold transition-all disabled:opacity-50 shadow-green-glow"
                  >
                    {loading ? 'Running Tests...' : 'Apply Patch & Verify'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-text-muted font-mono">
                {patchApplied ? '✓ Fix verified and permanently committed to code repository.' : 'Select files from Explorer to inspect content.'}
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 3: AI DEBUG AGENT (col-span-4) */}
        <aside className="lg:col-span-4 flex flex-col justify-between overflow-y-auto">
          
          <div className="p-6 space-y-6 flex-grow text-left">
            
            {/* Real Pipeline Timelines */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono font-bold text-text-secondary uppercase tracking-widest">Agent Pipeline</h3>
              
              <div className="space-y-4 border-l border-border-default pl-4 relative font-mono text-xs">
                
                {/* 01 LISTEN */}
                <div className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-bg-dominant ${
                    getStepStatus(1) === 'completed' ? 'bg-brand-primary' : 'bg-border-default'
                  }`} />
                  <span className="font-bold text-text-primary block">01 LISTEN</span>
                  <span className="text-[10px] text-text-secondary">Problem analyzed.</span>
                </div>

                {/* 02 COLLECT */}
                <div className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-bg-dominant ${
                    getStepStatus(2) === 'completed' ? 'bg-brand-primary' : 'bg-border-default'
                  }`} />
                  <span className="font-bold text-text-primary block">02 COLLECT</span>
                  <span className="text-[10px] text-text-secondary">Project files and metadata logs gathered.</span>
                </div>

                {/* 03 ANALYZE */}
                <div className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-bg-dominant ${
                    getStepStatus(3) === 'completed' ? 'bg-brand-primary' : (getStepStatus(3) === 'active' ? 'bg-brand-accent animate-pulse' : 'bg-border-default')
                  }`} />
                  <span className="font-bold text-text-primary block">03 ANALYZE</span>
                  <span className="text-[10px] text-text-secondary">Directory trees parsed; languages detected.</span>
                </div>

                {/* 04 TRACE */}
                <div className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-bg-dominant ${
                    getStepStatus(4) === 'completed' ? 'bg-brand-primary' : (getStepStatus(4) === 'active' ? 'bg-brand-accent animate-pulse' : 'bg-border-default')
                  }`} />
                  <span className="font-bold text-text-primary block">04 TRACE</span>
                  <span className="text-[10px] text-text-secondary">Baseline sandbox failure verified.</span>
                </div>

                {/* 05 REPAIR */}
                <div className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-bg-dominant ${
                    getStepStatus(5) === 'completed' ? 'bg-brand-primary' : 'bg-border-default'
                  }`} />
                  <span className="font-bold text-text-primary block">05 REPAIR</span>
                  <span className="text-[10px] text-text-secondary">Gemini code patch generated.</span>
                </div>

                {/* 06 EXECUTE */}
                <div className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-bg-dominant ${
                    getStepStatus(6) === 'completed' ? 'bg-brand-primary' : (getStepStatus(6) === 'active' ? 'bg-brand-accent animate-pulse' : 'bg-border-default')
                  }`} />
                  <span className="font-bold text-text-primary block">06 EXECUTE</span>
                  <span className="text-[10px] text-text-secondary">Executing tests in isolated environment.</span>
                </div>

                {/* 07 VERIFY */}
                <div className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-bg-dominant ${
                    getStepStatus(7) === 'completed' ? 'bg-brand-primary' : 'bg-border-default'
                  }`} />
                  <span className="font-bold text-text-primary block">07 VERIFY</span>
                  <span className="text-[10px] text-text-secondary">Outcome confirmed fixed.</span>
                </div>

              </div>
            </div>

            {/* Sandbox live terminal runner output */}
            {terminalOutput && (
              <div className="bg-black border border-border-default rounded overflow-hidden">
                <div className="bg-panel-default px-3 py-1.5 border-b border-border-default flex items-center gap-2 text-[10px] text-text-secondary font-bold uppercase tracking-wider select-none">
                  <TermIcon size={12} className="text-brand-primary" /> Live Sandbox Terminal
                </div>
                <pre className="p-3 bg-[#050705] font-mono text-[10px] text-[#A6E22E] overflow-x-auto min-h-[120px] max-h-[220px]">
                  {terminalOutput}
                </pre>
              </div>
            )}

            {/* Agent Events logs checklist */}
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold text-text-secondary uppercase tracking-widest block">Agent Logs</span>
              <div className="bg-panel-default border border-border-default rounded-xl p-4 space-y-2 text-xs font-mono max-h-[180px] overflow-y-auto">
                {mission.events && mission.events.length > 0 ? (
                  mission.events.map((evt) => (
                    <div key={evt.id} className="text-[11px] text-text-secondary leading-normal border-b border-border-default/20 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-brand-accent font-bold">[{evt.agent_name}]</span> {evt.message}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-text-muted">No logs recorded yet.</div>
                )}
              </div>
            </div>

          </div>

          {/* Unified locked/unlocked Mirror triggers */}
          <div className="h-20 border-t border-border-default bg-panel-default px-6 flex items-center justify-between select-none">
            <div className="text-left">
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">Mirror AI status</span>
              {mission.status === 'VERIFIED_FIXED' ? (
                <span className="text-xs font-bold text-brand-primary">Unlocked</span>
              ) : (
                <span className="text-xs font-bold text-text-muted flex items-center gap-1"><Lock size={10} /> Locked</span>
              )}
            </div>
            
            <div className="flex gap-2">
              {mission.status === 'VERIFIED_FIXED' && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="border border-border-default hover:border-brand-primary px-4 py-2 rounded text-xs font-mono text-text-secondary hover:text-text-primary transition-all"
                >
                  Report
                </button>
              )}

              {mission.status === 'VERIFIED_FIXED' ? (
                <a 
                  href={`/mirror/${mission.id}`}
                  className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-2 rounded font-sans text-xs font-bold transition-colors shadow-green-glow"
                >
                  Continue to Mirror →
                </a>
              ) : (
                <button 
                  disabled 
                  className="bg-border-default text-text-muted px-5 py-2 rounded font-sans text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
                >
                  <Lock size={12} /> Continue to Mirror
                </button>
              )}
            </div>
          </div>

        </aside>

      </div>

      {/* View Debug Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel-default border border-border-default max-w-2xl w-full rounded-xl p-6 space-y-4 text-left font-mono text-xs overflow-y-auto max-h-[85vh]">
            
            <div className="flex justify-between items-center border-b border-border-default pb-3.5">
              <span className="font-bold text-text-primary uppercase tracking-wider">DM-#DM-{mission.id} Debug Report</span>
              <button onClick={() => setShowReportModal(false)} className="text-text-secondary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-text-muted uppercase block">Problem:</span>
                <p className="text-text-secondary mt-1">{mission.voice_transcript}</p>
              </div>

              {mission.screenshot_path && (
                <div>
                  <span className="text-[10px] text-text-muted uppercase block">Attached Screenshot:</span>
                  <img src={mission.screenshot_path} alt="Report Screenshot" className="mt-1 max-w-[200px] border border-border-default rounded" />
                </div>
              )}

              <div>
                <span className="text-[10px] text-text-muted uppercase block">Applied Patch Diff:</span>
                {mission.changes && mission.changes.length > 0 ? (
                  <pre className="p-3 bg-[#050705] border border-border-default rounded text-[10px] mt-1 space-y-0.5 text-text-secondary">
                    <div className="text-red-400">- {mission.changes[0].before_content}</div>
                    <div className="text-brand-primary">+ {mission.changes[0].after_content}</div>
                  </pre>
                ) : (
                  <p className="text-text-muted">No patch applied.</p>
                )}
              </div>

              <div>
                <span className="text-[10px] text-text-muted uppercase block">Sandbox Test Outcome:</span>
                <span className="text-brand-primary font-bold">✓ Tests Executed and Verified Fixed</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-default">
              <button
                onClick={() => setShowReportModal(false)}
                className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-1.5 rounded font-bold transition-colors"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SkillDebug;
