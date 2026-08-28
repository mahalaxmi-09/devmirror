import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, Database, Play, Sparkles, User, Mail, Lock } from 'lucide-react';
import api from '../utils/api';

const Auth = ({ setUser }) => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const toggleMode = () => {
    setIsSignIn(!isSignIn);
    setError('');
    setSuccess('');
    setFormData({ full_name: '', email: '', password: '', confirmPassword: '' });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validations
    if (!formData.email || !formData.password) {
      setError('Please fill in all credentials.');
      return;
    }
    if (!isSignIn) {
      if (!formData.full_name) {
        setError('Full Name is required.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    const endpoint = isSignIn ? '/auth/login' : '/auth/register';
    const payload = isSignIn 
      ? { email: formData.email, password: formData.password }
      : { email: formData.email, password: formData.password, full_name: formData.full_name };

    try {
      const response = await api.post(endpoint, payload);
      setSuccess(response.data.message || 'Authenticated successfully.');
      
      // Save details
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      setTimeout(() => {
        setUser(response.data.user);
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-bg-dominant overflow-hidden">
      
      {/* LEFT SIDE: Brand storytelling */}
      <div className="hidden lg:flex lg:col-span-7 bg-bg-secondary border-r border-border-default flex-col justify-between p-12 relative overflow-hidden">
        
        {/* Glowing grid effect in background */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#7CFF4F_1px,transparent_1px),linear-gradient(to_bottom,#7CFF4F_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-primary/10 blur-[100px] pointer-events-none" />

        {/* Brand header */}
        <div className="flex items-center gap-2.5 z-10">
          <div className="w-8 h-8 rounded border border-brand-primary flex items-center justify-center bg-panel-default text-brand-primary font-bold">
            DM
          </div>
          <span className="text-xl font-bold tracking-wider text-text-primary">DEVMIRROR AI</span>
        </div>

        {/* Value Proposition */}
        <div className="my-auto max-w-xl z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-text-primary"
          >
            Debug with an agent.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">
              Understand yourself
            </span> as an engineer.
          </motion.h1>

          {/* Connected Flow Animation */}
          <div className="mt-16 relative flex items-center justify-between px-4 max-w-lg">
            {/* Connection line background */}
            <div className="absolute left-8 right-8 top-1/2 h-[1px] bg-border-default -translate-y-1/2 z-0" />
            
            {/* Glowing line progress overlay */}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute left-8 right-8 top-1/2 h-[1.5px] bg-brand-primary origin-left -translate-y-1/2 z-0"
            />

            {['VOICE', 'CODE', 'DEBUG', 'VERIFY', 'MIRROR'].map((step, idx) => (
              <div key={step} className="flex flex-col items-center gap-2.5 z-10">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: idx * 0.4 }}
                  className="w-12 h-12 rounded-full border border-border-default bg-panel-default flex items-center justify-center text-[10px] font-mono tracking-wider font-semibold text-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors cursor-pointer"
                >
                  {step === 'VOICE' && '🎙️'}
                  {step === 'CODE' && '📂'}
                  {step === 'DEBUG' && '🧠'}
                  {step === 'VERIFY' && '🧪'}
                  {step === 'MIRROR' && '🪞'}
                </motion.div>
                <span className="text-[10px] font-mono tracking-widest text-text-muted">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating status components */}
        <div className="flex flex-wrap gap-4 z-10">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-default bg-panel-default/50 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[11px] font-mono text-text-secondary">AI Debug Engine Active</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-default bg-panel-default/50 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[11px] font-mono text-text-secondary">Sandbox Ready</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-default bg-panel-default/50 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[11px] font-mono text-text-secondary">Verification Active</span>
          </div>
        </div>

      </div>

      {/* RIGHT SIDE: Auth form */}
      <div className="col-span-1 lg:col-span-5 flex flex-col justify-center p-8 sm:p-12 md:p-16">
        <div className="max-w-md w-full mx-auto space-y-8">
          
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">
              {isSignIn ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="mt-2.5 text-sm text-text-secondary">
              {isSignIn ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={toggleMode} 
                className="text-brand-primary hover:text-brand-accent transition-colors font-medium underline"
              >
                {isSignIn ? 'Create one now' : 'Sign in instead'}
              </button>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 mt-8">
            
            {/* Inline Notifications */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded border border-red-500/20 bg-red-950/20 text-red-400 text-xs font-mono"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded border border-brand-primary/20 bg-brand-primary/5 text-brand-accent text-xs font-mono"
              >
                {success}
              </motion.div>
            )}

            {/* Name (Registration Only) */}
            {!isSignIn && (
              <div className="space-y-1.5">
                <label className="block text-xs font-mono tracking-wider text-text-secondary uppercase">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-text-muted">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="w-full bg-panel-default border border-border-default rounded p-3 pl-10 text-sm text-text-primary focus:border-brand-primary focus:outline-none transition-colors"
                    placeholder="Ada Lovelace"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono tracking-wider text-text-secondary uppercase">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-text-muted">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-panel-default border border-border-default rounded p-3 pl-10 text-sm text-text-primary focus:border-brand-primary focus:outline-none transition-colors"
                  placeholder="ada@devmirror.ai"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-mono tracking-wider text-text-secondary uppercase">Password</label>
                {isSignIn && (
                  <a href="#forgot" className="text-[11px] font-mono text-text-muted hover:text-brand-primary transition-colors">
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-text-muted">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full bg-panel-default border border-border-default rounded p-3 pl-10 pr-10 text-sm text-text-primary focus:border-brand-primary focus:outline-none transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Registration Only) */}
            {!isSignIn && (
              <div className="space-y-1.5">
                <label className="block text-xs font-mono tracking-wider text-text-secondary uppercase">Confirm Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-text-muted">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full bg-panel-default border border-border-default rounded p-3 pl-10 text-sm text-text-primary focus:border-brand-primary focus:outline-none transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            {/* Remember Me */}
            {isSignIn && (
              <div className="flex items-center justify-between text-xs font-mono">
                <label className="flex items-center gap-2 cursor-pointer text-text-secondary">
                  <input type="checkbox" className="accent-brand-primary rounded border-border-default bg-panel-default" />
                  Remember me
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary text-bg-dominant hover:bg-brand-accent disabled:opacity-50 font-bold py-3.5 px-4 rounded transition-all duration-150 flex items-center justify-center font-sans tracking-wide text-sm"
            >
              {loading ? 'Authenticating…' : isSignIn ? 'Sign In' : 'Create Account'}
            </button>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border-default"></div>
              <span className="flex-shrink mx-4 text-[10px] font-mono text-text-muted uppercase">or</span>
              <div className="flex-grow border-t border-border-default"></div>
            </div>

            {/* OAuth GitHub Fallback */}
            <button
              type="button"
              onClick={() => {
                alert('GitHub connection integration is operational. Continuing in simulated lab environment.');
                setFormData({
                  full_name: 'GitHub Engineer',
                  email: 'github@devmirror.ai',
                  password: 'github_oauth_auth_key',
                  confirmPassword: 'github_oauth_auth_key'
                });
              }}
              className="w-full border border-border-default hover:border-brand-primary bg-panel-default text-text-secondary hover:text-text-primary font-bold py-3 px-4 rounded transition-colors text-sm flex items-center justify-center gap-2.5"
            >
              <span>🐙</span> Continue with GitHub
            </button>
          </form>

          {/* Terms & Privacy */}
          <p className="text-center text-[10px] font-mono text-text-muted">
            By signing in, you agree to our <a href="#terms" className="underline hover:text-text-secondary">Terms of Service</a> and <a href="#privacy" className="underline hover:text-text-secondary">Privacy Policy</a>.
          </p>

        </div>
      </div>

    </div>
  );
};

export default Auth;
