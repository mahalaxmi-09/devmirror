import React, { useState, useEffect } from 'react';
import { Clock, Trash2, ArrowLeft, ExternalLink, ShieldAlert } from 'lucide-react';

const HistoryPage = ({ user, handleLogout }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('mirror_history_sessions');
    if (stored) {
      try {
        setHistory(JSON.parse(stored).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }
  }, []);

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all analysis history?')) {
      localStorage.removeItem('mirror_history_sessions');
      setHistory([]);
    }
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem('mirror_history_sessions', JSON.stringify(updated));
    setHistory(updated);
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
            <a href="/history" className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-panel-default border border-border-default text-brand-primary">
              <span className="w-3.5 h-3.5 flex items-center justify-center">🕒</span> History
            </a>

            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mt-6 mb-2 font-bold">System</div>
            <a href="/settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <span className="w-3.5 h-3.5 flex items-center justify-center">⚙️</span> Settings
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

      {/* History Panel Content */}
      <main className="lg:col-span-10 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6 text-left">
          
          <header className="border-b border-border-default pb-5 flex flex-wrap justify-between items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Clock className="text-brand-primary" size={28} /> Analysis History
              </h1>
              <p className="text-sm text-text-secondary font-mono mt-1">Audit trail of past Mirror AI compiler and debugging sessions.</p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 hover:bg-red-950/10 rounded text-[10px] font-mono text-red-400 hover:border-red-500/50 transition-colors"
              >
                <Trash2 size={12} /> Clear History
              </button>
            )}
          </header>

          {history.length === 0 ? (
            <div className="border border-border-default rounded-xl p-12 text-center space-y-3 bg-panel-default">
              <Clock size={36} className="text-text-muted mx-auto" />
              <h3 className="font-bold text-sm">No analysis history found</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Any successful Mirror AI code or PDF analysis session will be logged here automatically.
              </p>
              <a
                href="/mirror"
                className="inline-block mt-4 bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-2 rounded text-xs font-mono font-bold uppercase transition-colors"
              >
                Start New Session
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <a
                  key={item.id}
                  href={`/mirror?history_id=${item.id}`}
                  className="block bg-panel-default border border-border-default hover:border-brand-primary/40 rounded-xl p-4 transition-colors text-left"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono uppercase bg-bg-secondary px-2.5 py-1 rounded text-text-secondary border border-border-default/50">
                        {item.language}
                      </span>
                      <h3 className="font-bold text-sm hover:text-brand-primary transition-colors truncate max-w-md">
                        {item.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary font-mono truncate max-w-2xl mb-3">
                    {item.request}
                  </p>

                  <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
                    <div className="flex items-center gap-3">
                      {item.result?.severity && item.result?.severity !== 'none' && (
                        <span className={`px-2 py-0.5 rounded border uppercase ${
                          item.result.severity === 'critical' || item.result.severity === 'high'
                            ? 'text-red-400 border-red-500/30'
                            : 'text-yellow-400 border-yellow-500/30'
                        }`}>
                          {item.result.severity}
                        </span>
                      )}
                      <span>Lines: {item.code?.split('\n').length || 0}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => deleteItem(item.id, e)}
                        className="hover:text-red-400 p-1 rounded transition-colors"
                        title="Delete Session"
                      >
                        <Trash2 size={12} />
                      </button>
                      <span className="text-brand-primary flex items-center gap-1">
                        Open <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default HistoryPage;
