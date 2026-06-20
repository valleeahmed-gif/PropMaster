import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Field } from '../components/UI';
import { LogoIcon } from '../components/Logo';

// ── Shared auth shell ──────────────────────────────────────
function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-100">
      {/* Top brand bar */}
      <div className="px-4 sm:px-8 py-5">
        <Link to="/login" className="inline-flex items-center gap-2.5 group">
          <LogoIcon size={32} />
          <span className="font-bold text-ink-900 tracking-tight">PropMaster</span>
        </Link>
      </div>

      {/* Centered auth card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md page-enter">
          <div className="text-center mb-6">
            <h1 className="font-display text-3xl text-ink-900 tracking-tight">{title}</h1>
            <p className="text-sm text-ink-500 mt-2">{subtitle}</p>
          </div>

          <div className="card p-6 sm:p-7 shadow-md">
            {children}
          </div>

          <p className="text-center text-sm text-ink-500 mt-5">{footer}</p>
        </div>
      </div>

      {/* Subtle footer */}
      <div className="text-center pb-6 px-4">
        <p className="text-2xs text-ink-400 tracking-wide">
          Property management for South African landlords · ZAR
        </p>
      </div>
    </div>
  );
}

// ── Login Page ─────────────────────────────────────────────
export function LoginPage() {
  const navigate = useNavigate();
  const { login, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await login(email, password);
    setLoading(false);
    if (!err) {
      showToast('Welcome back!');
      navigate('/');
    } else {
      setError(err);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your portfolio"
      footer={<>New to PropMaster? <Link to="/signup" className="text-brand-700 font-semibold hover:underline">Create account</Link></>}
    >
      <div className="space-y-4">
        <Field label="Email address" required>
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete="email"
            autoFocus
          />
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              className="input pr-10"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1 rounded"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2.5 ring-1 ring-red-100" role="alert">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary w-full justify-center py-3"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
          ) : (
            <>Sign in <ArrowRight size={16} /></>
          )}
        </button>
      </div>
    </AuthShell>
  );
}

// ── Signup Page ────────────────────────────────────────────
export function SignupPage() {
  const navigate = useNavigate();
  const { signup, showToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Please enter your full name';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Please enter a valid email';
    if (!password || password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error: err } = await signup(name.trim(), email.trim(), password);
    setLoading(false);
    if (!err) {
      showToast('Account created! Check your email to confirm, then sign in.');
      navigate('/login');
    } else {
      setErrors({ general: err });
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start managing your properties in minutes"
      footer={<>Already have an account? <Link to="/login" className="text-brand-700 font-semibold hover:underline">Sign in</Link></>}
    >
      <div className="space-y-4">
        <Field label="Full name" required error={errors.name}>
          <input
            type="text"
            className="input"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
            autoFocus
          />
        </Field>
        <Field label="Email address" required error={errors.email}>
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required error={errors.password} hint="At least 8 characters">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Choose a strong password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {errors.general && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2.5 ring-1 ring-red-100" role="alert">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{errors.general}</span>
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full justify-center py-3">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account…</>
          ) : (
            <>Create account <ArrowRight size={16} /></>
          )}
        </button>

        <p className="text-2xs text-ink-400 text-center px-4">
          By creating an account, you agree that PropMaster handles your portfolio data per the privacy terms.
        </p>
      </div>
    </AuthShell>
  );
}
