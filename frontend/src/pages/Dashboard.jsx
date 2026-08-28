import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, AlertCircle, Compass, History, Settings, LogOut, CheckCircle, Clock, Database, Plus, Mail, Upload, X, BarChart2, Mic, FolderOpen, Target } from 'lucide-react';
import api from '../utils/api';
import { getTimeBasedGreeting, msUntilNextGreetingBoundary } from '../utils/greeting';

const Dashboard = ({ user, handleLogout }) => {
  const [missions, setMissions] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  // File Upload State
  const fileInputRef = useRef(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [problemDescription, setProblemDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const greetingName = (user?.full_name || '').trim().split(/\s+/).filter(Boolean)[0] || '';
  const [welcomeLine, setWelcomeLine] = useState(() => getTimeBasedGreeting(new Date(), greetingName));

  useEffect(() => {
    const refreshGreeting = () => {
      setWelcomeLine(getTimeBasedGreeting(new Date(), greetingName));
    };
    refreshGreeting();
    let boundaryTimer;
    const armBoundary = () => {
      clearTimeout(boundaryTimer);
      boundaryTimer = setTimeout(() => {
        refreshGreeting();
        armBoundary();
      }, msUntilNextGreetingBoundary(new Date()));
    };
    armBoundary();
    const interval = setInterval(refreshGreeting, 30 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshGreeting();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(boundaryTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [greetingName]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [missionsRes, challengesRes, skillsRes] = await Promise.all([
          api.get('/missions'),
          api.get('/challenges'),
          api.get('/skills')
        ]);
        setMissions(missionsRes.data);
        setChallenges(challengesRes.data);
        setSkills(skillsRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleStartDemoMission = async () => {
    try {
      const response = await api.post('/missions', {
        voice_transcript: 'My authorization token verification is returning 401 exceptions on user authentication requests.',
        isDemo: true,
        language: 'javascript'
      });
      window.location.href = `/debug/${response.data.id}`;
    } catch (err) {
      alert('Error initializing demo mission: ' + err.message);
    }
  };

  const startNewVoiceMission = () => {
    window.location.href = '/debug';
  };

  const handleStartChallenge = async (id) => {
    try {
      const response = await api.post(`/challenges/${id}/start`, { mode: 'GUIDED' });
      window.location.href = `/debug/${response.data.mission.id}`;
    } catch (err) {
      alert('Error starting challenge: ' + err.message);
    }
  };

  // Handles client-side file selection
  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedUploadFile({
        name: file.name,
        size: file.size,
        type: file.type,
        content: event.target.result
      });
      setProblemDescription(`Debugging file: ${file.name}`);
      setUploadModalOpen(true);
    };
    reader.readAsText(file);
  };

  // Submits the selected file and initializes debugging session
  const handleLaunchUploadedMission = async (e) => {
    e.preventDefault();
    if (!selectedUploadFile || isUploading) return;

    setIsUploading(true);
    try {
      // 1. Detect language from extension
      const ext = selectedUploadFile.name.split('.').pop() || 'js';
      let language = 'javascript';
      if (ext === 'py') language = 'python';
      else if (ext === 'go') language = 'go';
      else if (ext === 'rs') language = 'rust';

      // 2. Create mission record
      const missionRes = await api.post('/missions', {
        voice_transcript: problemDescription,
        language
      });
      const missionId = missionRes.data.id;

      // 3. Upload the source file content to the mission registry
      await api.post(`/missions/${missionId}/files`, {
        filename: selectedUploadFile.name,
        file_content: selectedUploadFile.content
      });

      // 4. Redirect to the newly created debugging session
      window.location.href = `/debug/${missionId}`;
    } catch (err) {
      alert('Failed to initialize debug mission: ' + err.message);
      setIsUploading(false);
    }
  };

  // Metrics Calculations (NO static fake fallbacks!)
  const debugSessionsCount = missions.length;
  const bugsVerifiedCount = missions.filter(m => m.status === 'VERIFIED_FIXED' || m.status === 'VERIFIED').length;

  const latestSignals = skills.length > 0 ? skills[skills.length - 1] : null;
  const skillSignalAverage = latestSignals 
    ? Math.round(
        (latestSignals.communication + 
         latestSignals.problem_solving + 
         latestSignals.debugging + 
         latestSignals.technical_understanding + 
         latestSignals.independent_reasoning) / 5
      )
    : 0;

  // Streak calculation from real dates
  const calculateStreak = () => {
    if (missions.length === 0) return 0;
    
    const dates = missions
      .map(m => new Date(m.created_at).toDateString())
      .filter((value, index, self) => self.indexOf(value) === index)
      .map(d => new Date(d));

    dates.sort((a, b) => b - a);

    let streak = 0;
    let today = new Date();
    today.setHours(0,0,0,0);
    
    let compareDate = new Date(today);
    
    const latestDate = dates[0];
    if (!latestDate) return 0;
    
    const diffTime = Math.abs(compareDate - latestDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      return 0;
    }

    for (let i = 0; i < dates.length; i++) {
      const diff = Math.abs(compareDate - dates[i]);
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      
      if (days === streak) {
        streak++;
        compareDate.setDate(compareDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  return (
    <div className="min-h-screen bg-bg-dominant grid grid-cols-1 lg:grid-cols-12 text-text-primary">
      
      {/* Sidebar Navigation */}
      <aside className="lg:col-span-2 bg-bg-secondary border-r border-border-default flex flex-col justify-between p-6">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border border-brand-primary flex items-center justify-center bg-panel-default text-brand-primary font-bold text-xs">
              D
            </div>
            <span className="font-bold tracking-wider text-xs font-mono">DEVMIRROR AI</span>
          </div>

          <nav className="flex flex-col gap-1.5 text-xs font-mono text-text-secondary text-left">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mb-2 font-bold">Workspace</div>
            <a href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-panel-default border border-border-default text-brand-primary">
              <BarChart2 size={14} /> Overview
            </a>
            <button onClick={startNewVoiceMission} className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary text-left">
              <Mic size={14} /> SkillDebug
            </button>
            <a href="#history" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <FolderOpen size={14} /> Missions
            </a>
            <a href="/mirror" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Sparkles size={14} /> Mirror AI
            </a>
            <a href="#challenges" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Target size={14} /> Challenges
            </a>
            <a href="#history" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <Clock size={14} /> History
            </a>

            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest px-3 mt-6 mb-2 font-bold">System</div>
            <a href="#settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded hover:bg-panel-default hover:text-text-primary">
              <span>⚙️</span> Settings
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

      {/* Main Content Area */}
      <main className="lg:col-span-10 p-6 lg:p-10 space-y-8 overflow-y-auto">
        
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-default pb-6 text-left">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{welcomeLine}.</h1>
            <p className="text-xs text-text-secondary font-mono mt-1">Your AI debugging workspace is ready.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleStartDemoMission}
              className="border border-brand-primary/30 hover:border-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-accent px-4 py-2 rounded font-mono text-xs font-bold transition-all"
            >
              🚀 Run Controlled Demo (Auto-bug)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-text-muted animate-pulse">
            Syncing workspace telemetry...
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Top row widget snap */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
              
              {/* DEBUG SESSIONS */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2.5">
                <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest block font-bold">Debug Sessions</span>
                <div className="text-3xl font-black font-mono text-text-primary">
                  {debugSessionsCount}
                </div>
                <span className="text-[10px] text-text-muted font-mono block">
                  {debugSessionsCount > 0 ? "Completed real sessions" : "No debugging sessions yet"}
                </span>
              </div>

              {/* BUGS VERIFIED */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2.5">
                <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest block font-bold">Bugs Verified</span>
                <div className="text-3xl font-black font-mono text-brand-primary">
                  {bugsVerifiedCount}
                </div>
                <span className="text-[10px] text-text-muted font-mono block">
                  {bugsVerifiedCount > 0 ? "Actual sandbox verification passes" : "No successful fixes yet"}
                </span>
              </div>

              {/* SKILL SIGNAL */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2.5">
                <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest block font-bold">Skill Signal</span>
                <div className="text-3xl font-black font-mono text-brand-accent">
                  {skillSignalAverage > 0 ? `${skillSignalAverage}%` : "0%"}
                </div>
                <span className="text-[10px] text-text-muted font-mono block">
                  {skillSignalAverage > 0 ? "Latest overall AI signal" : "Mirror AI not active"}
                </span>
              </div>

              {/* CURRENT STREAK */}
              <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-2.5">
                <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest block font-bold">Current Streak</span>
                <div className="text-3xl font-black font-mono text-text-primary">
                  {currentStreak}
                </div>
                <span className="text-[10px] text-text-muted font-mono block">
                  Consecutive active days
                </span>
              </div>

            </div>

            {/* Dashboard Main CTA Card */}
            <div className="bg-panel-default border border-border-default rounded-xl p-6 text-left space-y-4">
              <h2 className="text-lg font-bold">Start a new debugging mission</h2>
              <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">
                Explain your problem by voice or text. Give the agent your real code and let it investigate, fix and verify the issue.
              </p>
              
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={startNewVoiceMission}
                  className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-2.5 rounded font-sans text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  🎙️ Start Voice Debug
                </button>
                
                {/* Upload File Input ref */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-border-default hover:border-brand-primary bg-bg-secondary text-text-secondary hover:text-text-primary px-4 py-2.5 rounded font-mono text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Upload size={14} className="text-brand-primary" />
                  <span>Upload File</span>
                </button>
              </div>
            </div>

            {/* Main Split: Missions history & Skill snapshot */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Recent Debugging Missions */}
              <div id="history" className="lg:col-span-8 bg-panel-default border border-border-default rounded-xl p-5 space-y-4 text-left">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold font-mono text-text-primary uppercase tracking-wider">Recent Debugging Missions</h3>
                  <span className="text-[10px] font-mono text-text-muted">Dynamic registry logs</span>
                </div>

                {missions.length === 0 ? (
                  <div className="border border-dashed border-border-default rounded p-12 text-center text-xs font-mono text-text-muted">
                    No debugging missions yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border-default text-text-muted uppercase text-[10px] tracking-wider">
                          <th className="pb-3 pl-2">Mission</th>
                          <th className="pb-3">Problem</th>
                          <th className="pb-3">Project</th>
                          <th className="pb-3">Attempts</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 pr-2 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missions.map((mission) => (
                          <tr
                            key={mission.id}
                            onClick={() => window.location.href = `/debug/${mission.id}`}
                            className="border-b border-border-default/50 hover:bg-panel-elevated/45 cursor-pointer transition-colors"
                          >
                            <td className="py-3 pl-2 font-bold text-brand-primary">#DM-{mission.id}</td>
                            <td className="py-3 max-w-[150px] truncate pr-4 text-text-secondary">{mission.voice_transcript || 'Direct text code upload'}</td>
                            <td className="py-3 text-text-muted truncate max-w-[100px]">demo_auth_project</td>
                            <td className="py-3 text-center">{mission.attempts_count}</td>
                            <td className="py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold ${
                                (mission.status === 'VERIFIED_FIXED' || mission.status === 'VERIFIED') 
                                  ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/25' 
                                  : mission.status === 'FAILED' 
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/25'
                                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25'
                              }`}>
                                {(mission.status === 'VERIFIED_FIXED' || mission.status === 'VERIFIED') ? '✓ VERIFIED' : mission.status === 'FAILED' ? '✕ FAILED' : '● IN PROGRESS'}
                              </span>
                            </td>
                            <td className="py-3 pr-2 text-right text-text-muted text-[10px]">
                              {new Date(mission.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right Column: Mirror AI panel */}
              <div id="mirror" className="lg:col-span-4 space-y-6">
                
                {/* YOUR MIRROR PANEL */}
                <div className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4 text-left">
                  <h3 className="text-sm font-bold font-mono text-text-primary uppercase tracking-wider">Your Mirror</h3>
                  {latestSignals ? (
                    <div className="space-y-3.5 font-mono text-xs">
                      <div>
                        <div className="flex justify-between mb-1 text-text-secondary">
                          <span>Communication</span>
                          <span className="text-brand-primary font-bold">{latestSignals.communication}%</span>
                        </div>
                        <div className="w-full bg-bg-secondary h-1 rounded overflow-hidden">
                          <div className="bg-brand-primary h-full" style={{ width: `${latestSignals.communication}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 text-text-secondary">
                          <span>Problem Solving</span>
                          <span className="text-brand-primary font-bold">{latestSignals.problem_solving}%</span>
                        </div>
                        <div className="w-full bg-bg-secondary h-1 rounded overflow-hidden">
                          <div className="bg-brand-primary h-full" style={{ width: `${latestSignals.problem_solving}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 text-text-secondary">
                          <span>Debugging</span>
                          <span className="text-brand-primary font-bold">{latestSignals.debugging}%</span>
                        </div>
                        <div className="w-full bg-bg-secondary h-1 rounded overflow-hidden">
                          <div className="bg-brand-primary h-full" style={{ width: `${latestSignals.debugging}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 text-text-secondary">
                          <span>Technical Understanding</span>
                          <span className="text-brand-primary font-bold">{latestSignals.technical_understanding}%</span>
                        </div>
                        <div className="w-full bg-bg-secondary h-1 rounded overflow-hidden">
                          <div className="bg-brand-primary h-full" style={{ width: `${latestSignals.technical_understanding}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 text-text-secondary">
                          <span>Independent Reasoning</span>
                          <span className="text-brand-primary font-bold">{latestSignals.independent_reasoning}%</span>
                        </div>
                        <div className="w-full bg-bg-secondary h-1 rounded overflow-hidden">
                          <div className="bg-brand-primary h-full" style={{ width: `${latestSignals.independent_reasoning}%` }} />
                        </div>
                      </div>
                      <div className="pt-2">
                        <a
                          href={`/mirror/${missions.find(m => m.status === 'VERIFIED_FIXED' || m.status === 'VERIFIED')?.id}`}
                          className="w-full flex items-center justify-center py-2.5 border border-brand-primary text-brand-primary bg-brand-primary/5 hover:bg-brand-primary hover:text-bg-dominant transition-all rounded text-center text-xs font-bold"
                        >
                          Open Mirror AI Reflector →
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 border border-dashed border-border-default rounded text-xs font-mono text-text-muted leading-relaxed">
                      Complete your first debugging session to activate Mirror AI.
                    </div>
                  )}
                </div>

                {/* Challenges listing */}
                <div id="challenges" className="bg-panel-default border border-border-default rounded-xl p-5 space-y-4 text-left">
                  <h3 className="text-sm font-bold font-mono text-text-primary uppercase tracking-wider">Recommended Challenges</h3>
                  
                  {challenges.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border-default rounded text-xs font-mono text-text-muted">
                      No challenges recommended yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {challenges.slice(0, 1).map(challenge => (
                        <div
                          key={challenge.id}
                          className="p-3 bg-bg-secondary border border-border-default hover:border-brand-primary rounded space-y-2 transition-colors font-mono text-xs"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-text-primary truncate pr-2">{challenge.title}</span>
                            <span className="text-[9px] text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-1.5 py-0.5 rounded uppercase">
                              {challenge.code_language}
                            </span>
                          </div>
                          <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-2">
                            {challenge.description}
                          </p>
                          <button
                            onClick={() => handleStartChallenge(challenge.id)}
                            className="w-full py-1 text-center bg-panel-default border border-border-default hover:border-brand-primary text-text-secondary hover:text-brand-primary transition-all text-[10px] font-bold rounded"
                          >
                            Accept Challenge
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Upload File Modal showing exactly which file we have to add */}
      {uploadModalOpen && selectedUploadFile && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleLaunchUploadedMission}
            className="bg-panel-default border border-border-default max-w-md w-full rounded-xl p-6 space-y-4 text-left font-mono text-xs"
          >
            <div className="flex justify-between items-center border-b border-border-default pb-3.5">
              <span className="font-bold text-text-primary uppercase tracking-wider">Initialize Debug Mission</span>
              <button 
                type="button" 
                onClick={() => setUploadModalOpen(false)} 
                className="text-text-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {/* Display which file we have to add */}
            <div className="p-3.5 bg-bg-secondary border border-border-default rounded space-y-2">
              <span className="text-[10px] font-bold text-text-muted uppercase block">Selected File to Upload:</span>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-brand-primary">{selectedUploadFile.name}</span>
                <span className="text-text-muted text-[10px]">
                  {Math.round(selectedUploadFile.size / 1024 * 100) / 100} KB
                </span>
              </div>
              <span className="text-[9px] text-text-muted/75 italic block font-sans">
                Content preview is loaded and ready for AI scanning.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-text-secondary uppercase">Problem Description / Symptoms</label>
              <textarea
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                className="w-full bg-bg-secondary border border-border-default rounded p-2.5 text-text-primary focus:border-brand-primary focus:outline-none min-h-[90px]"
                placeholder="Explain the error symptoms or unexpected behaviour here..."
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="px-3.5 py-1.5 border border-border-default rounded hover:bg-bg-secondary transition-colors text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="bg-brand-primary text-bg-dominant hover:bg-brand-accent px-4 py-1.5 rounded font-bold transition-colors shadow-green-glow disabled:opacity-50"
              >
                {isUploading ? 'Launching Agent...' : 'Launch Debug Mission'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
