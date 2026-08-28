import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, BarChart2, Mic, FolderOpen, Target, Clock, Settings,
  Loader2, Upload, Play, CheckCircle2, AlertCircle, FileCode2
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

function Panel({ title, children, className = '' }) {
  return (
    <section className={`bg-panel-default border border-border-default rounded-xl overflow-hidden ${className}`}>
      <header className="px-4 py-2.5 border-b border-border-default bg-bg-secondary/50">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const MirrorCoach = ({ user, handleLogout }) => {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState('javascript');
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [analyzing, setAnalyzing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [aiHealth, setAiHealth] = useState(null);
  const [result, setResult] = useState(null);
  const [originalCode, setOriginalCode] = useState('');
  const [appliedCode, setAppliedCode] = useState(null);
  const [verification, setVerification] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/ai/health')
      .then((res) => setAiHealth(res.data))
      .catch(() => setAiHealth({ status: 'unavailable', hint: 'Could not reach the AI health endpoint.' }));
  }, []);

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

  const handleAnalyze = async () => {
    if (!code.trim()) {
      setErrorBanner('Paste or upload source code first.');
      return;
    }
    if (!request.trim()) {
      setErrorBanner('Enter a debugging request.');
      return;
    }

    setAnalyzing(true);
    setErrorBanner('');
    setResult(null);
    setOriginalCode(code);
    setAppliedCode(null);
    setVerification(null);

    try {
      const response = await api.post('/mirror/analyze', { code, language, request });
      setResult(response.data);
    } catch (err) {
      const msg = toErrorMessage(
        err.response?.data?.error || err.response?.data || err.message,
        'Mirror AI analysis failed. Check backend AI configuration.'
      );
      setErrorBanner(msg);
    } finally {
      setAnalyzing(false);
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
      const msg = toErrorMessage(
        err.response?.data?.error || err.response?.data || err.message,
        'Verification failed.'
      );
      setErrorBanner(msg);
      setVerification({ status: 'error', output: msg });
    } finally {
      setVerifying(false);
    }
  };

  const proposedFix = result?.fixedCode;
  const hasFix = Boolean(proposedFix && proposedFix.trim() !== originalCode.trim());
  const isVerified = verification?.status === 'passed';
  const isFixed = Boolean(appliedCode);

  return (
    <div className="min-h-screen bg-bg-dominant grid grid-cols-1 lg:grid-cols-12 text-text-primary font-sans">
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

      <main className="lg:col-span-10 p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6 text-left">
          <header className="border-b border-border-default pb-5">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="text-brand-primary" size={28} /> Mirror AI
            </h1>
            <p className="text-sm text-text-secondary font-mono mt-1">{timeOfDayGreeting()} — AI-powered code debugging assistant.</p>
          </header>

          {aiHealth?.status === 'unavailable' && (
            <div role="status" className="border border-yellow-500/30 bg-yellow-950/20 text-yellow-200 text-xs font-mono px-4 py-3 rounded">
              Mirror AI provider is unavailable. {aiHealth.hint || 'Add a valid GEMINI_API_KEY (AIza...) or another provider in backend/.env.'}
            </div>
          )}

          {errorBanner && (
            <div role="alert" className="border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono px-4 py-3 rounded flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorBanner}</span>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel title="Source Code Editor">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <label htmlFor="mirror-language" className="text-[10px] font-mono text-text-muted uppercase">Language</label>
                <select
                  id="mirror-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-bg-secondary border border-border-default rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".js,.ts,.py,.java,.go,.rs,.txt,.json,.html,.css,.php,.rb,.c,.cpp,.cs" className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-border-default rounded text-[10px] font-mono hover:border-brand-primary transition-colors"
                >
                  <Upload size={12} /> Upload
                </button>
              </div>
              <textarea
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setAppliedCode(null);
                }}
                spellCheck={false}
                className="w-full bg-bg-secondary border border-border-default rounded-lg p-3 text-xs font-mono leading-relaxed min-h-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                placeholder="Paste your source code here..."
              />
            </Panel>

            <Panel title="Debugging Request">
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                className="w-full bg-bg-secondary border border-border-default rounded-lg p-3 text-xs font-sans leading-relaxed min-h-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                placeholder='e.g. "Fix this code", "Explain this error", "Find bugs in this code"'
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-green-glow disabled:opacity-50 flex items-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Analyze with Mirror AI
                    </>
                  )}
                </button>
              </div>
            </Panel>
          </div>

          {result && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
                {hasFix && !isFixed && (
                  <span className="px-2 py-1 rounded border border-brand-primary/40 text-brand-primary">Fix proposed</span>
                )}
                {isFixed && (
                  <span className="px-2 py-1 rounded border border-brand-primary/40 text-brand-primary flex items-center gap-1">
                    <CheckCircle2 size={12} /> Fixed
                  </span>
                )}
                {isVerified && (
                  <span className="px-2 py-1 rounded border border-green-500/40 text-green-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Verified
                  </span>
                )}
                {result.severity && result.severity !== 'none' && (
                  <span className="px-2 py-1 rounded border border-yellow-500/30 text-yellow-300 uppercase">
                    Severity: {result.severity}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel title="Original Code">
                  <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto leading-relaxed">{originalCode || code}</pre>
                </Panel>

                <Panel title="Proposed Fix">
                  {proposedFix ? (
                    <pre className="text-xs font-mono text-brand-accent whitespace-pre-wrap overflow-x-auto leading-relaxed">{proposedFix}</pre>
                  ) : (
                    <p className="text-xs text-text-muted font-mono">No corrected code returned.</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleApplyFix}
                      disabled={!hasFix || isFixed}
                      className="px-4 py-2 border border-brand-primary text-brand-primary rounded text-xs font-mono font-bold uppercase hover:bg-brand-primary/10 disabled:opacity-40 transition-colors"
                    >
                      Apply Fix
                    </button>
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifying || (!proposedFix && !appliedCode)}
                      className="px-4 py-2 border border-border-default rounded text-xs font-mono font-bold uppercase hover:border-brand-primary flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                    >
                      {verifying ? (
                        <>
                          <Loader2 size={12} className="animate-spin" /> Running...
                        </>
                      ) : (
                        <>
                          <Play size={12} /> Verify
                        </>
                      )}
                    </button>
                  </div>
                </Panel>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel title="AI Explanation">
                  <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
                    {result.analysis || result.explanation || 'No explanation provided.'}
                  </div>
                  {result.error && (
                    <div className="mt-3 p-3 bg-red-950/20 border border-red-500/20 rounded text-xs text-red-300 font-mono">
                      <span className="font-bold uppercase text-[10px] block mb-1">Detected problem</span>
                      {result.error}
                    </div>
                  )}
                </Panel>

                <Panel title="Changes">
                  {result.changes?.length > 0 ? (
                    <ul className="space-y-2 text-xs text-text-secondary font-mono">
                      {result.changes.map((change, i) => (
                        <li key={i} className="flex gap-2">
                          <FileCode2 size={14} className="text-brand-primary shrink-0 mt-0.5" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-muted font-mono">No changes listed.</p>
                  )}
                </Panel>
              </div>

              {(verification || result.verification) && (
                <Panel title="Verification">
                  {(() => {
                    const v = verification || result.verification;
                    const statusColors = {
                      passed: 'text-green-400 border-green-500/30',
                      failed: 'text-red-400 border-red-500/30',
                      error: 'text-red-400 border-red-500/30',
                      unsupported: 'text-yellow-300 border-yellow-500/30',
                      not_run: 'text-text-muted border-border-default'
                    };
                    const color = statusColors[v?.status] || statusColors.not_run;
                    return (
                      <div>
                        <p className={`text-[10px] font-mono uppercase font-bold mb-2 px-2 py-1 inline-block border rounded ${color}`}>
                          Status: {v?.status || 'unknown'}
                        </p>
                        <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap mt-2 bg-bg-secondary border border-border-default rounded p-3 overflow-x-auto">
                          {v?.output || 'No output.'}
                        </pre>
                        {v?.exitCode !== undefined && v?.exitCode !== null && (
                          <p className="text-[10px] font-mono text-text-muted mt-2">Exit code: {v.exitCode}</p>
                        )}
                      </div>
                    );
                  })()}
                </Panel>
              )}

              {appliedCode && (
                <Panel title="Updated Code (after Apply Fix)">
                  <pre className="text-xs font-mono text-brand-primary whitespace-pre-wrap overflow-x-auto leading-relaxed">{appliedCode}</pre>
                </Panel>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MirrorCoach;
