import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Shield, Sliders, Monitor, Mic, Video, Eye } from 'lucide-react';

const Settings = ({ user, handleLogout }) => {
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('setting_compact') === 'true');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('setting_font_size') || '12'));
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('setting_ai_provider') || 'auto');
  const [autoVerify, setAutoVerify] = useState(() => localStorage.getItem('setting_auto_verify') !== 'false');
  
  const [cameraPermission, setCameraPermission] = useState('unknown');
  const [micPermission, setMicPermission] = useState('unknown');

  useEffect(() => {
    // Check permission status if API available
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' })
        .then((status) => setCameraPermission(status.state))
        .catch(() => {});
        
      navigator.permissions.query({ name: 'microphone' })
        .then((status) => setMicPermission(status.state))
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
            <span className="font-bold tracking-wider text-xs font-mono">DEVMIRROR AI</span>
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
            <a href="/settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-panel-default border border-border-default text-brand-primary">
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
            <p className="text-sm text-text-secondary font-mono mt-1">Configure your personal AI workspace and telemetry settings.</p>
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

            {/* AI Preferences */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
                <Sliders size={14} /> AI Engine Preferences
              </h2>
              <div className="space-y-4 pt-2 text-xs font-mono">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-ai-provider" className="text-[10px] text-text-muted uppercase">Preferred AI Engine</label>
                  <select
                    id="settings-ai-provider"
                    value={aiProvider}
                    onChange={(e) => {
                      setAiProvider(e.target.value);
                      saveSetting('setting_ai_provider', e.target.value);
                    }}
                    className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                  >
                    <option value="auto">Auto Fallback (Recommended)</option>
                    <option value="openai">OpenAI ChatGPT (gpt-4o)</option>
                    <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-[11px]">Auto Verify Solution</span>
                    <span className="text-[10px] text-text-muted">Automatically compile & test AI-generated code patches.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoVerify}
                    onChange={(e) => {
                      setAutoVerify(e.target.checked);
                      saveSetting('setting_auto_verify', e.target.checked);
                    }}
                    className="w-4 h-4 accent-brand-primary bg-bg-secondary border-border-default rounded"
                  />
                </div>
              </div>
            </section>

            {/* Appearance Settings */}
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
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="settings-font-size" className="text-[10px] text-text-muted uppercase">Editor Code Font Size</label>
                  <select
                    id="settings-font-size"
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(Number(e.target.value));
                      saveSetting('setting_font_size', e.target.value);
                    }}
                    className="bg-bg-secondary border border-border-default rounded px-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                  >
                    <option value="11">11px (Tiny)</option>
                    <option value="12">12px (Compact)</option>
                    <option value="13">13px (Default)</option>
                    <option value="14">14px (Medium)</option>
                    <option value="16">16px (Large)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Telemetry Permissions */}
            <section className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
                <Shield size={14} /> Device Permission Telemetry
              </h2>
              <div className="space-y-4 pt-2 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-border-default pb-3">
                  <div className="flex items-center gap-2">
                    <Mic size={14} className="text-brand-primary" />
                    <div>
                      <span className="font-bold block text-[11px]">Microphone Permissions</span>
                      <span className="text-[10px] text-text-muted">Web Speech API Voice input permission status.</span>
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
                      <span className="text-[10px] text-text-muted">Gaze/telemetry detection webcam permissions status.</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border rounded uppercase ${
                    cameraPermission === 'granted' ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'
                  }`}>{cameraPermission}</span>
                </div>
              </div>
            </section>
          </div>

          {/* Privacy Information Panel */}
          <section className="bg-panel-default border border-border-default rounded-xl p-6 space-y-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
              <Eye size={14} /> Security & Privacy Policies
            </h2>
            <div className="text-xs text-text-secondary leading-relaxed font-sans space-y-2 pt-2">
              <p>🔑 <strong>API Security</strong>: Your OpenAI and Gemini API credentials are never exposed to the browser. All key resolution is managed securely via backend environment variables.</p>
              <p>📂 <strong>Ephemeral Uploads</strong>: Source files and technical PDFs are parsed dynamically in memory or stored in isolated temporary workspaces. No documents are retained permanently on our servers.</p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

export default Settings;
