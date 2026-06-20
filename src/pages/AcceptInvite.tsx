import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, AlertCircle, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LogoIcon } from '../components/Logo';
import { Field } from '../components/UI';

type Step = 'loading' | 'set-password' | 'linking' | 'done' | 'error' | 'already-linked';

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');

  const [step, setStep] = useState<Step>('loading');
  const [tenantName, setTenantName] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Prevent double-init from React StrictMode
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (!tenantId) {
      setError('This invite link is missing required information.');
      setStep('error');
      return;
    }

    // ── Listen for the magic-link session to be established ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          await handleSession(session.user);
        }
      }
    );

    // ── Also check immediately in case session is already set ──
    const checkExisting = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        subscription.unsubscribe();
        await handleSession(session.user);
      }
    };

    // ── Timeout if no session arrives within 5s ──
    const timeoutId = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        subscription.unsubscribe();
        setError('This invite link has expired or has already been used. Ask your landlord to resend the invite.');
        setStep('error');
      }
    }, 5000);

    checkExisting();

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [tenantId]);

  const handleSession = async (sbUser: any) => {
    if (!tenantId) return;

    try {
      // Load tenant record + property name in parallel
      const [tenantRes, leaseRes] = await Promise.all([
        supabase.from('tenants')
          .select('name, invite_status, user_id')
          .eq('id', tenantId)
          .maybeSingle(),
        supabase.from('leases')
          .select('properties(name)')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      const tenant = tenantRes.data;
      const propName = (leaseRes.data as any)?.properties?.name;

      if (!tenant) {
        setError('We couldn\'t find your tenant record. Please contact your landlord.');
        setStep('error');
        return;
      }

      setTenantName(tenant.name);
      if (propName) setPropertyName(propName);

      // Already accepted by someone else? Or different user?
      if (tenant.invite_status === 'accepted' && tenant.user_id && tenant.user_id !== sbUser.id) {
        setError('This tenant account has already been claimed by a different user.');
        setStep('error');
        return;
      }

      // Already linked to this same user — skip password step
      if (tenant.invite_status === 'accepted' && tenant.user_id === sbUser.id) {
        setStep('already-linked');
        setTimeout(() => navigate('/tenant/home'), 1800);
        return;
      }

      // Fresh invite — let them set a password
      setStep('set-password');
    } catch (err: any) {
      setError(err.message || 'Failed to load your invite. Please try again.');
      setStep('error');
    }
  };

  const linkAccount = async (userId: string) => {
    setStep('linking');
    try {
      if (!tenantId) throw new Error('Missing tenant ID');

      // 1. Link auth user to tenant record
      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({ user_id: userId, invite_status: 'accepted' })
        .eq('id', tenantId);

      if (tenantErr) throw new Error(`Couldn't link tenant: ${tenantErr.message}`);

      // 2. Set/upsert tenant role (overrides any default landlord role from the signup trigger)
      const { error: roleErr } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: 'tenant' }, { onConflict: 'user_id' });

      if (roleErr) throw new Error(`Couldn't set role: ${roleErr.message}`);

      setStep('done');
      // Give the success animation a beat, then redirect
      setTimeout(() => navigate('/tenant/home'), 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to set up your account. Please contact your landlord.');
      setStep('error');
    }
  };

  const handleSetPassword = async () => {
    setError('');
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);

    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please click your invite link again.');

      await linkAccount(user.id);
    } catch (err: any) {
      setError(err.message || 'Failed to set password. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-100">
      {/* Top brand */}
      <div className="px-4 sm:px-8 py-5">
        <div className="inline-flex items-center gap-2.5">
          <LogoIcon size={32} />
          <span className="font-bold text-ink-900 tracking-tight">PropMaster</span>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md page-enter">
          {/* Personal welcome */}
          {(tenantName || propertyName) && step !== 'error' && (
            <div className="text-center mb-6">
              <p className="text-2xs font-bold text-brand-700 uppercase tracking-widest mb-2">
                Welcome to PropMaster
              </p>
              <h1 className="font-display text-3xl text-ink-900 tracking-tight">
                {tenantName ? `Hi, ${tenantName.split(' ')[0]}` : 'Welcome'}
              </h1>
              {propertyName && (
                <p className="text-sm text-ink-500 mt-2">
                  Your home at <span className="font-semibold text-ink-700">{propertyName}</span>
                </p>
              )}
            </div>
          )}

          <div className="card p-6 sm:p-7 shadow-md">
            {step === 'loading' && (
              <div className="py-10 flex flex-col items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full animate-spin"
                  style={{
                    borderWidth: 3,
                    borderStyle: 'solid',
                    borderColor: '#d2f3e5',
                    borderTopColor: '#0e7c64',
                  }}
                  role="status"
                  aria-label="Setting up"
                />
                <p className="text-sm text-ink-500">Setting up your account…</p>
              </div>
            )}

            {step === 'set-password' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Set your password</h2>
                  <p className="text-sm text-ink-500 mt-1 leading-relaxed">
                    Choose a password to secure your tenant account. You'll use this to log in each time.
                  </p>
                </div>

                <Field label="New password" required hint="At least 8 characters">
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Choose a strong password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm password" required>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                    autoComplete="new-password"
                  />
                </Field>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2.5 ring-1 ring-red-100"
                  >
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={handleSetPassword}
                  disabled={saving}
                  className="btn-primary w-full justify-center py-3 mt-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    <>Continue <CheckCircle size={16} /></>
                  )}
                </button>
              </div>
            )}

            {step === 'linking' && (
              <div className="py-10 flex flex-col items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full animate-spin"
                  style={{
                    borderWidth: 3,
                    borderStyle: 'solid',
                    borderColor: '#d2f3e5',
                    borderTopColor: '#0e7c64',
                  }}
                  role="status"
                />
                <p className="text-sm text-ink-500">Linking your account…</p>
              </div>
            )}

            {step === 'done' && (
              <div className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center ring-4 ring-brand-100">
                  <CheckCircle size={32} className="text-brand-700" />
                </div>
                <div>
                  <p className="font-display text-2xl text-ink-900 tracking-tight">You're all set!</p>
                  <p className="text-sm text-ink-500 mt-1.5">
                    Taking you to your tenant portal…
                  </p>
                </div>
              </div>
            )}

            {step === 'already-linked' && (
              <div className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">
                  <Sparkles size={32} className="text-brand-700" />
                </div>
                <div>
                  <p className="font-display text-2xl text-ink-900 tracking-tight">Welcome back</p>
                  <p className="text-sm text-ink-500 mt-1.5">
                    You're already set up — taking you home…
                  </p>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="py-6 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertCircle size={32} className="text-red-500" />
                </div>
                <div>
                  <p className="font-display text-2xl text-ink-900 tracking-tight">
                    Something went wrong
                  </p>
                  <p className="text-sm text-ink-500 mt-1.5 leading-relaxed max-w-sm">
                    {error}
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => navigate('/login')} className="btn-secondary flex-1">
                    Go to login
                  </button>
                  <a
                    href="mailto:?subject=PropMaster invite issue&body=Hi, my PropMaster invite link isn't working. Could you please send me a new one?"
                    className="btn-primary flex-1"
                  >
                    <Mail size={14} /> Email landlord
                  </a>
                </div>
              </div>
            )}
          </div>

          {step !== 'error' && step !== 'done' && step !== 'already-linked' && (
            <p className="text-center text-2xs text-ink-400 mt-4 px-4">
              By continuing, you agree to PropMaster handling your account per the privacy terms.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
