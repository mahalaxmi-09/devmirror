import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Shield, Sliders, Monitor, Mic, Video, Eye, Award } from 'lucide-react';

const PRACTICE_MODES = [
  { id: 'mock', label: 'Mock Interview' },
  { id: 'presentation', label: 'Presentation Practice' },
  { id: 'viva', label: 'Project Viva' },
  { id: 'technical', label: 'Technical Interview' },
  { id: 'hr', label: 'HR Interview' },
  { id: 'resume', label: 'Resume Interview' },
  { id: 'study', label: 'Study Material Interview' },
  { id: 'rapid', label: 'Rapid Fire' },
  { id: 'stress', label: 'Stress Interview' },
  { id: 'communication', label: 'Communication Practice' },
  { id: 'placement', label: 'Placement Simulation' },
  { id: 'weakness', label: 'Weakness Practice' }
];

const Settings = ({ user, handleLogout }) => {
  // Practice preferences
  const [defaultMode, setDefaultMode] = useState(() => localStorage.getItem('setting_default_mode') || 'mock');
  const [difficulty, setDifficulty] = useState(() => localStorage.getItem('setting_difficulty') || 'medium');
  const [questionCount, setQuestionCount] = useState(() => Number(localStorage.getItem('setting_question_count') || '5'));
  const [duration, setDuration] = useState(() => Number(localStorage.getItem('setting_duration') || '15'));
  const [followUp, setFollowUp] = useState(() => localStorage.getItem('setting_follow_up') !== 'false');

  // AI & Feedback preferences
  const [interviewerStyle, setInterviewerStyle] = useState(() => localStorage.getItem('setting_interviewer_style') || 'mixed');
  const [feedbackDetail, setFeedbackDetail] = useState(() => localStorage.getItem('setting_feedback_detail') || 'balanced');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('setting_compact') === 'true');

  // Permission Telemetries
  const [cameraPermission, setCameraPermission] = useState('unknown');
  const [micPermission, setMicPermission] = useState('unknown');

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' })
        .then((status) => {
          setCameraPermission(status.state);
          status.onchange = () => setCameraPermission(status.state);
        })
        .catch(() => {});
        
      navigator.permissions.query({ name: 'microphone' })
        .then((status) => {
          setMicPermission(status.state);
          status.onchange = () => setMicPermission(status.state);
        })
        .catch(() => {});
    }
  }, []);

  const saveSetting = (key, value) => {
    localStorage.setItem(key, value);
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
            <span className="font-bold tracking-wider text-xs font-mono text-brand-primary">DEVMIRROR AI</span>
          </div>

          <nav className="flex flex-col gap-1.5 text-xs font-mono text-text-secondary text-left">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mb-2 font-bold">Workspace</div>
            <a href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <span className="w-3.5 h-3.5 flex items-center justify-center">📊</span> Overview
            </a>
            <a href="/debug" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <span className="w-3.5 h-3.5 flex items-center justify-center">🎙️</span> SkillDebug
            </a>
            <a href="/dashboard#history" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <span className="w-3.5 h-3.5 flex items-center justify-center">📂</span> Missions
            </a>
            <a href="/mirror" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <span className="w-3.5 h-3.5 flex items-center justify-center">✨</span> Mirror AI
            </a>
            <a href="/history" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <span className="w-3.5 h-3.5 flex items-center justify-center">🕒</span> History
            </a>

            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mt-6 mb-2 font-bold">System</div>
            <a href="/settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-panel-default border border-border-default text-brand-primary font-bold">
              <SettingsIcon size={14} /> Settings
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

      {/* Settings Panel Content */}
      <main className="lg:col-span-10 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8 text-left">
          
          <header className="border-b border-border-default pb-5">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <SettingsIcon className="text-brand-primary" size={28} /> Settings
            </h1>
            <p className="text-sm text-text-secondary font-mono mt-1">Configure your personal AI interviewer and communication feedback tools.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Account Info */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
                <User size={14} /> Account Profile
              </h2>
              <div className="space-y-3 pt-2 text-xs font-mono">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Name</span>
                  <span className="text-text-primary text-sm font-semibold">{user?.full_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Email</span>
                  <span className="text-text-primary text-sm font-semibold">{user?.email || 'N/A'}</span>
                </div>
              </div>
            </section>

            {/* Interview Settings */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
                <Award size={14} /> Interview Preferences
              </h2>
              <div className="space-y-4 pt-2 text-xs font-mono">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-default-mode" className="text-[10px] text-text-muted uppercase">Default Prep Mode</label>
                  <select
                    id="settings-default-mode"
                    value={defaultMode}
                    onChange={(e) => {
                      setDefaultMode(e.target.value);
                      saveSetting('setting_default_mode', e.target.value);
                    }}
                    className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                  >
                    {PRACTICE_MODES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-difficulty" className="text-[10px] text-text-muted uppercase">Difficulty Rating</label>
                  <select
                    id="settings-difficulty"
                    value={difficulty}
                    onChange={(e) => {
                      setDifficulty(e.target.value);
                      saveSetting('setting_difficulty', e.target.value);
                    }}
                    className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                  >
                    <option value="beginner">Beginner (Foundations)</option>
                    <option value="intermediate">Intermediate (Standard)</option>
                    <option value="advanced">Advanced (Deep Dive)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-questions" className="text-[10px] text-text-muted uppercase">Question Limit</label>
                    <select
                      id="settings-questions"
                      value={questionCount}
                      onChange={(e) => {
                        setQuestionCount(Number(e.target.value));
                        saveSetting('setting_question_count', e.target.value);
                      }}
                      className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none"
                    >
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="15">15 Questions</option>
                      <option value="20">20 Questions</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="settings-duration" className="text-[10px] text-text-muted uppercase">Duration Limit</label>
                    <select
                      id="settings-duration"
                      value={duration}
                      onChange={(e) => {
                        setDuration(Number(e.target.value));
                        saveSetting('setting_duration', e.target.value);
                      }}
                      className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none"
                    >
                      <option value="10">10 Minutes</option>
                      <option value="15">15 Minutes</option>
                      <option value="20">20 Minutes</option>
                      <option value="30">30 Minutes</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-[11px]">Enable Follow-up Questions</span>
                    <span className="text-[10px] text-text-muted">Interviewer asks adaptive follow-ups based on response quality.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={followUp}
                    onChange={(e) => {
                      setFollowUp(e.target.checked);
                      saveSetting('setting_follow_up', e.target.checked);
                    }}
                    className="w-4 h-4 accent-brand-primary bg-bg-secondary border-border-default rounded"
                  />
                </div>
              </div>
            </section>

            {/* AI Preferences */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
                <Sliders size={14} /> AI Evaluator Preferences
              </h2>
              <div className="space-y-4 pt-2 text-xs font-mono">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-interviewer-style" className="text-[10px] text-text-muted uppercase">Interviewer Personality</label>
                  <select
                    id="settings-interviewer-style"
                    value={interviewerStyle}
                    onChange={(e) => {
                      setInterviewerStyle(e.target.value);
                      saveSetting('setting_interviewer_style', e.target.value);
                    }}
                    className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                  >
                    <option value="mixed">Mixed HR & Tech Balanced</option>
                    <option value="technical">Highly Technical & Analytical</option>
                    <option value="hr">HR & Soft-skills Evaluator</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-feedback-detail" className="text-[10px] text-text-muted uppercase">Feedback Detail Level</label>
                  <select
                    id="settings-feedback-detail"
                    value={feedbackDetail}
                    onChange={(e) => {
                      setFeedbackDetail(e.target.value);
                      saveSetting('setting_feedback_detail', e.target.value);
                    }}
                    className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                  >
                    <option value="concise">Concise Summary Card</option>
                    <option value="balanced">Balanced metrics & suggestions</option>
                    <option value="detailed">Exhaustive template guidelines</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Layout settings */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
                <Monitor size={14} /> Appearance & Layout
              </h2>
              <div className="space-y-4 pt-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-[11px]">Compact Workspace Mode</span>
                    <span className="text-[10px] text-text-muted">Reduces panel padding to maximize screen space.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={compactMode}
                    onChange={(e) => {
                      setCompactMode(e.target.checked);
                      saveSetting('setting_compact', e.target.checked);
                    }}
                    className="w-4 h-4 accent-brand-primary bg-bg-secondary border-border-default rounded"
                  />
                </div>
              </div>
            </section>

            {/* Permissions */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
                <Shield size={14} /> Telemetry Permissions
              </h2>
              <div className="space-y-4 pt-2 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-border-default pb-3">
                  <div className="flex items-center gap-2">
                    <Mic size={14} className="text-brand-primary" />
                    <div>
                      <span className="font-bold block text-[11px]">Microphone Permissions</span>
                      <span className="text-[10px] text-text-muted">Web Speech API audio recording status.</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                    micPermission === 'granted' ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'
                  }`}>{micPermission}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video size={14} className="text-brand-primary" />
                    <div>
                      <span className="font-bold block text-[11px]">Camera Permissions</span>
                      <span className="text-[10px] text-text-muted">Live practice visual preview permission status.</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                    cameraPermission === 'granted' ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'
                  }`}>{cameraPermission}</span>
                </div>
              </div>
            </section>
          </div>

          {/* Privacy */}
          <section className="bg-panel-default border border-border-default rounded-xl p-6 space-y-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
              <Eye size={14} /> Privacy & Workspace Standards
            </h2>
            <div className="text-xs text-text-secondary leading-relaxed font-sans space-y-2 pt-2">
              <p>🔒 <strong>Secure Caching</strong>: Resume uploads, PDF files, and viva responses are cached strictly in browser memory or temporary databases, never sold, and can be purged at any time from your History page.</p>
              <p>🎥 <strong>Media Stream Protection</strong>: Live camera frames and vocal recordings are parsed ephemerally on-the-fly and never recorded or uploaded permanently to external clouds.</p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

export default Settings;
