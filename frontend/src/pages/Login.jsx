import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Train, Mail, Lock, Loader2, ArrowRight, X, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import api from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: OTP & new pass, 3: success
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);
    
    try {
      const response = await api.post('/auth/forgot-password/request', { email: forgotEmail });
      setForgotMessage(response.data.message);
      setDemoOtp(response.data.demo_otp);
      setForgotStep(2);
    } catch (err) {
      console.error(err);
      setForgotError(err.response?.data?.detail || 'Failed to generate OTP. Please verify the email and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);
    
    try {
      const response = await api.post('/auth/forgot-password/verify', {
        email: forgotEmail,
        otp: forgotOtp,
        new_password: forgotNewPassword
      });
      setForgotMessage(response.data.message);
      setForgotStep(3);
    } catch (err) {
      console.error(err);
      setForgotError(err.response?.data?.detail || 'Verification failed. Please check the OTP code and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotState = () => {
    setForgotOpen(false);
    setForgotStep(1);
    setForgotEmail('');
    setForgotOtp('');
    setForgotNewPassword('');
    setDemoOtp('');
    setForgotMessage('');
    setForgotError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      
      const response = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-brand-500/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[25rem] h-[25rem] bg-indigo-500/10 rounded-full blur-[100px] -z-10" />
      
      <div className="w-full max-w-md">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-brand-500/20 border border-brand-500/30 rounded-2xl mb-3 shadow-glass-bright">
            <Train className="w-10 h-10 text-brand-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-brand-300 font-sans">
            Train Seat AI
          </h1>
          <p className="text-slate-400 text-sm mt-1 text-center max-w-xs">
            Autonomous AI Seating & Identity Verification Commute System
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-glass p-8 rounded-3xl shadow-glass relative group border border-slate-800/80">
          <h2 className="text-xl font-semibold text-white mb-6">Welcome Back</h2>
          
          {error && (
            <div className="p-3.5 mb-5 text-sm bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="email">
                Email Address or Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-sans text-sm"
                  placeholder="Email or Full Name"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-300 text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs text-brand-400 hover:underline font-semibold focus:outline-none transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-sans text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors focus:outline-none"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  Access Platform
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-400 border-t border-slate-900 pt-6">
            New to the platform?{' '}
            <Link to="/register" className="text-brand-400 hover:underline font-semibold transition-all">
              Create Passenger Account
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-md bg-slate-950/90 border border-slate-800 rounded-3xl p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={resetForgotState}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              Reset Password
            </h3>
            <p className="text-slate-400 text-sm mb-6 font-sans">
              {forgotStep === 1 && "Enter your registered email address to request a verification OTP code."}
              {forgotStep === 2 && "Enter the verification OTP and your desired new account password."}
              {forgotStep === 3 && "Your password has been successfully updated."}
            </p>

            {forgotMessage && (
              <div className="p-4 mb-6 text-sm bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{forgotMessage}</span>
              </div>
            )}

            {demoOtp && forgotStep === 2 && (
              <div className="p-3.5 mb-6 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl">
                🔑 <strong>Demo Mailer System:</strong> For testing, your 6-digit OTP code is: <strong className="text-white bg-slate-900 px-2 py-0.5 rounded font-mono text-sm border border-slate-800 select-all">{demoOtp}</strong>
              </div>
            )}

            {forgotError && (
              <div className="p-4 mb-6 text-sm bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStep === 1 && (
              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="forgot-email">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-sans text-sm"
                      placeholder="name@email.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group text-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Requesting OTP...
                    </>
                  ) : (
                    <>
                      Request Reset OTP
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOtpAndReset} className="space-y-5">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="forgot-otp">
                    Verification OTP Code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      id="forgot-otp"
                      type="text"
                      required
                      maxLength={6}
                      pattern="[0-9]{6}"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-sans text-sm tracking-[0.25em] text-center"
                      placeholder="000000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="forgot-newpass">
                    New Account Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      id="forgot-newpass"
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all font-sans text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors focus:outline-none"
                      title={showForgotNewPassword ? "Hide password" : "Show password"}
                    >
                      {showForgotNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group text-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving New Password...
                    </>
                  ) : (
                    <>
                      Verify & Change Password
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            )}
            
            {forgotStep === 3 && (
              <button
                type="button"
                onClick={resetForgotState}
                className="w-full mt-4 py-3.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all text-sm shadow-md active:scale-[0.98]"
              >
                Back to Login
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
