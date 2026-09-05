import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Train, User as UserIcon, Mail, Phone, Lock, Loader2, UserCheck, ShieldCheck } from 'lucide-react';
import api from '../api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState('Female');
  const [isDisabled, setIsDisabled] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register', {
        name,
        email,
        mobile,
        password,
        age: parseInt(age),
        gender,
        is_disabled: isDisabled,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Registration failed. Check if email/mobile is already registered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-brand-500/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[25rem] h-[25rem] bg-indigo-500/10 rounded-full blur-[100px] -z-10" />

      <div className="w-full max-w-lg my-8">
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-brand-500/20 border border-brand-500/30 rounded-2xl mb-3 shadow-glass-bright">
            <Train className="w-10 h-10 text-brand-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-brand-300 font-sans">
            Train Seat AI
          </h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            Create your account to initiate priority seat allocations
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-glass p-8 rounded-3xl shadow-glass border border-slate-800/80">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Passenger Registration</h2>
            <span className="text-[11px] font-semibold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Aadhaar Verification after login
            </span>
          </div>

          {success && (
            <div className="p-4 mb-6 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              Registration successful! Redirecting to login...
            </div>
          )}

          {error && (
            <div className="p-3.5 mb-6 text-sm bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="mobile">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="mobile"
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
                    placeholder="+919876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="age">
                  Age (for Priority Tiers)
                </label>
                <input
                  id="age"
                  type="number"
                  required
                  min="1"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="gender">
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Disability Toggle Checkbox */}
            <div className="p-4 rounded-2xl border bg-slate-900/40 border-slate-800/80 flex items-center justify-between mt-2 transition-all">
              <div className="flex flex-col">
                <span className="text-slate-200 text-sm font-medium">
                  Person with Disabilities (Divyangjan)
                </span>
                <span className="text-slate-400 text-xs mt-0.5">Enables eligibility for Coach A (accessible seats)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDisabled}
                  onChange={(e) => setIsDisabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500 peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-400 border-t border-slate-900 pt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:underline font-semibold transition-all">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
