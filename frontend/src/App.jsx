import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SkillDebug from './pages/SkillDebug';
import SkillMirror from './pages/SkillMirror';
import MirrorCoach from './pages/MirrorCoach';
import Settings from './pages/Settings';
import HistoryPage from './pages/HistoryPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  // If user lands on /auth with a stale session, let them stay on login
  // (don't auto-redirect to dashboard until they log in again)

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050705] flex items-center justify-center font-mono text-xs text-[#667067]">
        Loading System Interface...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Auth page — always show login form; dashboard redirect only after fresh login */}
        <Route
          path="/auth"
          element={<Auth setUser={setUser} />}
        />

        {/* Protected Dashboard */}
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard user={user} handleLogout={handleLogout} /> : <Navigate to="/auth" replace />} 
        />

        {/* Protected Debug sessions */}
        <Route 
          path="/debug" 
          element={user ? <SkillDebug /> : <Navigate to="/auth" replace />} 
        />
        <Route 
          path="/debug/:missionId" 
          element={user ? <SkillDebug /> : <Navigate to="/auth" replace />} 
        />

        {/* Protected SkillMirror report */}
        <Route 
          path="/mirror/:missionId" 
          element={user ? <SkillMirror /> : <Navigate to="/auth" replace />} 
        />
        
        {/* Protected Mirror AI Independent Coach */}
        <Route 
          path="/mirror" 
          element={user ? <MirrorCoach user={user} handleLogout={handleLogout} /> : <Navigate to="/auth" replace />} 
        />

        {/* Protected System Settings */}
        <Route 
          path="/settings" 
          element={user ? <Settings user={user} handleLogout={handleLogout} /> : <Navigate to="/auth" replace />} 
        />

        {/* Protected History Page */}
        <Route 
          path="/history" 
          element={user ? <HistoryPage user={user} handleLogout={handleLogout} /> : <Navigate to="/auth" replace />} 
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
