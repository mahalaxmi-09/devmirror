import React from 'react';
import { motion } from 'framer-motion';
import { Play, Sparkles, Terminal, CheckCircle2, Shield, ArrowRight, Activity, Cpu } from 'lucide-react';

const Landing = () => {
  const steps = [
    { num: '01', title: 'SPEAK', desc: 'Explain the problem naturally in your own voice.' },
    { num: '02', title: 'PROVIDE EVIDENCE', desc: 'Upload project directories, logs, error screenshots, or connect GitHub.' },
    { num: '03', title: 'INVESTIGATE', desc: 'AI reads the actual project files and traces the code failure paths.' },
    { num: '04', title: 'REPAIR', desc: 'AI generates and applies a code patch in an isolated sandbox.' },
    { num: '05', title: 'VERIFY', desc: 'Run automated tests and builds to verify regression-free success.' },
    { num: '06', title: 'REFLECT', desc: 'SkillMirror analyzes completed debugger session history to estimate signals.' }
  ];

  return (
    <div className="min-h-screen bg-bg-dominant text-text-primary flex flex-col">
      {/* Header */}
      <header className="border-b border-border-default bg-bg-dominant/80 backdrop-blur sticky top-0 z-50 px-6 lg:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded border border-brand-primary flex items-center justify-center bg-panel-default text-brand-primary font-bold text-sm">
            DM
          </div>
          <span className="font-bold tracking-wider text-sm font-mono">DEVMIRROR AI</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-mono text-text-secondary">
          <a href="#product" className="hover:text-brand-primary transition-colors">Product</a>
          <a href="#how-it-works" className="hover:text-brand-primary transition-colors">How It Works</a>
          <a href="#skillmirror" className="hover:text-brand-primary transition-colors">SkillMirror</a>
          <a href="#security" className="hover:text-brand-primary transition-colors">Security</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-brand-primary transition-colors">GitHub</a>
        </nav>

        <div className="flex items-center gap-4">
          <a href="/auth" className="text-xs font-mono text-text-secondary hover:text-text-primary transition-colors">
            Sign In
          </a>
          <a
            href="/auth"
            className="text-xs font-mono bg-brand-primary text-bg-dominant px-4 py-2 rounded hover:bg-brand-accent transition-colors font-bold"
          >
            Start Debugging
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow py-20 px-6 lg:px-12 max-w-7xl mx-auto w-full space-y-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero text */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-primary/20 bg-brand-primary/5 text-brand-primary text-[10px] font-mono tracking-widest uppercase">
              <Sparkles size={12} />
              AI-Powered Developer Intelligence
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
              Your AI Debugger.<br />
              Your Engineering<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">
                Mirror.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl">
              Explain a bug by voice, give us the real evidence, and let an autonomous agent investigate, fix, test, and verify your code. Then discover what your debugging session reveals about your engineering skills.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a
                href="/auth"
                className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-6 py-3.5 rounded font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-2"
              >
                Start Debugging <ArrowRight size={16} />
              </a>
              <a
                href="#how-it-works"
                className="border border-border-default hover:border-brand-primary bg-panel-default px-6 py-3.5 rounded font-bold text-sm tracking-wide text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Hero visual terminal visualization */}
          <div className="lg:col-span-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="bg-panel-default border border-border-default rounded-lg p-5 font-mono text-[11px] sm:text-xs text-text-secondary relative overflow-hidden green-glow"
            >
              {/* Terminal header */}
              <div className="flex items-center justify-between border-b border-border-default pb-3.5 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                  <span className="text-[10px] text-text-muted ml-2">agent_session_DM-9481.log</span>
                </div>
                <div className="flex items-center gap-1.5 text-brand-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                  <span className="text-[10px] uppercase font-bold">Live sandbox</span>
                </div>
              </div>

              {/* Data Flow timeline */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-text-muted font-bold">🎙️ Voice Request</div>
                  <div className="text-text-primary bg-bg-secondary p-2.5 rounded border border-border-default/50">
                    &quot;My login API returns 401 validation exceptions.&quot;
                  </div>
                </div>

                <div className="text-brand-primary flex items-center gap-2">
                  <span>↓</span>
                  <span className="text-text-muted">AI Agent initialized</span>
                </div>

                <div className="space-y-1">
                  <div className="text-text-muted font-bold">🧠 AI Agent</div>
                  <div className="text-brand-accent">
                    Inspecting authentication flow and tracing headers...
                  </div>
                </div>

                <div className="text-brand-primary flex items-center gap-2">
                  <span>↓</span>
                  <span className="text-text-muted">Analyzing source files</span>
                </div>

                <div className="space-y-1">
                  <div className="text-text-muted font-bold">🔍 Root Cause</div>
                  <div className="text-yellow-400 bg-yellow-950/20 border border-yellow-500/20 p-2.5 rounded">
                    Token parameter retrieved from body instead of request headers.
                  </div>
                </div>

                <div className="text-brand-primary flex items-center gap-2">
                  <span>↓</span>
                  <span className="text-text-muted">Patch generated</span>
                </div>

                <div className="space-y-1">
                  <div className="text-text-muted font-bold">🛠️ Patch Verification</div>
                  <div className="text-brand-primary flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Verification passed: 8/8 tests succeeded. exit code 0
                  </div>
                </div>

                <div className="text-brand-primary flex items-center gap-2">
                  <span>↓</span>
                  <span className="text-text-muted">SkillMirror calculation active</span>
                </div>

                <div className="space-y-1">
                  <div className="text-text-muted font-bold">🪞 SkillMirror</div>
                  <div className="text-text-primary">
                    Estimated signals: Communication 82% | Debugging 90%
                  </div>
                </div>
              </div>

            </motion.div>
          </div>

        </div>

        {/* How It Works Section */}
        <section id="how-it-works" className="space-y-12 border-t border-border-default pt-20">
          <div className="text-center max-w-xl mx-auto space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
            <p className="text-xs font-mono text-text-secondary uppercase tracking-widest text-brand-primary">
              Sequential Autonomic Loop
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, idx) => (
              <div 
                key={step.num}
                className="bg-panel-default border border-border-default rounded p-6 space-y-4 hover:border-brand-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold font-mono text-border-default select-none">
                    {step.num}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                </div>
                <h3 className="text-sm font-bold tracking-wide font-mono text-text-primary">
                  {step.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Platform statistics / features info */}
        <section id="security" className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border-default pt-20">
          <div className="bg-panel-default border border-border-default rounded p-8 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-brand-primary"><Shield size={24} /></div>
              <h3 className="text-lg font-bold">Secure Local Sandbox</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                We copy code environments to an isolated local execution thread, installing and executing unit tests safely. Security rules prevent environment variables exposure and verify safe exit statuses.
              </p>
            </div>
            <div className="text-[10px] font-mono text-text-muted">
              Rate limiting & CORS protected. JWT credentials validated.
            </div>
          </div>

          <div className="bg-panel-default border border-border-default rounded p-8 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-brand-accent"><Activity size={24} /></div>
              <h3 className="text-lg font-bold">Intelligent Competency Mirroring</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                SkillMirror monitors patterns of code analysis, trace runs, error resolution counts, and descriptions. It calculates estimated competency curves and identifies training modules matching gaps.
              </p>
            </div>
            <div className="text-[10px] font-mono text-text-muted">
              Powered by advanced Google Gemini models.
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border-default bg-bg-secondary py-8 px-6 lg:px-12 text-center text-xs font-mono text-text-muted">
        <div>&copy; {new Date().getFullYear()} DevMirror AI. All rights reserved. Debug. Reflect. Improve.</div>
      </footer>
    </div>
  );
};

export default Landing;
