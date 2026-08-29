import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, Database, Play, Sparkles, User, Mail, Lock } from 'lucide-react';
import api, { checkBackendHealth } from '../utils/api';
import { toErrorMessage } from '../utils/errorMessage';

const Auth = ({ setUser }) => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    checkBackendHealth(20000).then(setBackendOk);
  }, []);

  const toggleMode = () => {
    setIsSignIn(!isSignIn);
    setIsForgotPassword(false);
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

    if (isForgotPassword) {
      if (!formData.email) {
        setError('Email is required.');
        return;
      }
      setLoading(true);
      try {
        const response = await api.post('/auth/forgot-password', { email: formData.email });
        setSuccess(response.data.message || 'Simulated reset link sent.');
      } catch (err) {
        setError(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Failed to send reset link.'));
      } finally {
        setLoading(false);
      }
      return;
    }

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
      const response = await api.post(endpoint, payload, { timeout: 30000 });
      setSuccess(response.data.message || 'Authenticated successfully.');
      
      // Save details
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      setTimeout(() => {
        setUser(response.data.user);
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      setError(toErrorMessage(err.response?.data?.error || err.response?.data || err.message, 'Authentication failed. Please verify credentials.'));
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
      <div className="col-span-1 lg:col-span-5 flex flex-col justify-center items-center p-8 sm:p-12 select-none">
        <div className="glowing-login-container">
          <div 
            className="box"
            style={{ '--hover-height': isForgotPassword ? '360px' : (isSignIn ? '420px' : '490px') }}
          >
            <div className="login-card">
              <div className="loginBx w-full">
                
                {backendOk === false && (
                  <div role="alert" className="mb-2 p-2 rounded border border-yellow-500/30 bg-yellow-950/20 text-yellow-200 text-[9px] font-mono text-center">
                    Server is waking up...
                  </div>
                )}
                
                <h2 className="text-xs font-bold tracking-tight text-white mb-1 uppercase font-mono">
                  <i className="fa-solid fa-right-to-bracket mr-1.5"></i>
                  {isForgotPassword ? 'Reset Password' : isSignIn ? 'Login' : 'Register'}
                  <i className="fa-solid fa-heart ml-1.5"></i>
                </h2>

                <form onSubmit={handleSubmit} className="w-full space-y-3">
                  
                  {/* Inline Notifications */}
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2 rounded border border-red-500/20 bg-red-950/20 text-red-400 text-[10px] font-mono text-center select-text"
                    >
                      {error}
                    </motion.div>
                  )}

                  {success && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2 rounded border border-brand-primary/20 bg-brand-primary/5 text-brand-accent text-[10px] font-mono text-center select-text"
                    >
                      {success}
                    </motion.div>
                  )}

                  {/* Name (Registration Only) */}
                  {!isSignIn && !isForgotPassword && (
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="Full Name"
                      required
                    />
                  )}

                  {/* Email */}
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email Address"
                    required
                  />

                  {/* Password */}
                  {!isForgotPassword && (
                    <div className="relative w-full">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-secondary"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}

                  {/* Confirm Password (Registration Only) */}
                  {!isSignIn && !isForgotPassword && (
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm Password"
                      required
                    />
                  )}

                  {/* Remember Me & Forgot Password (Login Only) */}
                  {isSignIn && !isForgotPassword && (
                    <div className="flex justify-between items-center w-full text-[10px] font-mono px-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary hover:text-[#39FF14] transition-colors">
                        <input 
                          type="checkbox" 
                          className="accent-[#39FF14] cursor-pointer"
                        />
                        Remember me
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError('');
                          setSuccess('');
                        }}
                        className="text-text-muted hover:text-[#39FF14] transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#39FF14] text-[#050705] hover:shadow-[0_0_15px_#39FF14] font-bold py-2.5 px-4 rounded-full transition-all text-[11px] uppercase tracking-wider font-mono cursor-pointer"
                  >
                    {loading ? 'Processing…' : isForgotPassword ? 'Send Reset Link' : isSignIn ? 'Sign In' : 'Create Account'}
                  </button>

                  <div className="flex justify-center items-center text-[10px] font-mono mt-1 w-full text-center">
                    {isForgotPassword ? (
                      <button 
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(false);
                          setError('');
                          setSuccess('');
                        }}
                        className="text-text-muted hover:text-[#39FF14] transition-colors"
                      >
                        Back to Login
                      </button>
                    ) : (
                      <div className="text-text-muted">
                        {isSignIn ? "Don't have an account? " : "Already have an account? "}
                        <button 
                          type="button"
                          onClick={toggleMode} 
                          className="text-[#39FF14] hover:underline font-bold transition-colors ml-1"
                        >
                          {isSignIn ? 'Sign up' : 'Sign in'}
                        </button>
                      </div>
                    )}
                  </div>
                </form>

              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Auth;
