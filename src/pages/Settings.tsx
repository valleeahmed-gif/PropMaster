import React, { useState, useEffect } from 'react';
import { Building2, Save, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, Field } from '../components/UI';
import { formatCurrency, formatDate } from '../utils';

// ── Company / business profile settings ─────────────────────
// Everything captured here is printed on the invoices and reports
// the landlord generates, so they go out under their own business.
export function SettingsPage() {
  const { companyProfile, updateCompanyProfile, user, showToast } = useApp();

  const [form, setForm] = useState({
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    vatNumber: '',
    registrationNumber: '',
  });
  const [saving, setSaving] = useState(false);

  // Hydrate from the loaded profile (and whenever it changes)
  useEffect(() => {
    setForm({
      companyName: companyProfile?.companyName ?? '',
      companyEmail: companyProfile?.companyEmail ?? '',
      companyPhone: companyProfile?.companyPhone ?? '',
      companyAddress: companyProfile?.companyAddress ?? '',
      vatNumber: companyProfile?.vatNumber ?? '',
      registrationNumber: companyProfile?.registrationNumber ?? '',
    });
  }, [companyProfile]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompanyProfile(form);
      showToast('Company details saved — they now appear on your invoices and reports');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save — please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Live preview of the PDF masthead
  const displayName = form.companyName.trim() || 'PropMaster';

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Your business details for invoices and reports"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <Building2 size={17} className="text-brand-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-900">Company details</h3>
                <p className="text-xs text-ink-500">Printed on every invoice and report you generate</p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Company / business name" hint="Leave blank to fall back to “PropMaster”">
                <input
                  className="input"
                  value={form.companyName}
                  onChange={set('companyName')}
                  placeholder="e.g. Sea Point Property Co (Pty) Ltd"
                  autoFocus
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Business email">
                  <input className="input" type="email" value={form.companyEmail} onChange={set('companyEmail')} placeholder="accounts@yourcompany.co.za" />
                </Field>
                <Field label="Business phone">
                  <input className="input" value={form.companyPhone} onChange={set('companyPhone')} placeholder="021 555 0100" />
                </Field>
              </div>

              <Field label="Business address">
                <textarea
                  className="input min-h-[70px] resize-y"
                  value={form.companyAddress}
                  onChange={set('companyAddress')}
                  placeholder="Street, suburb, city, postal code"
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="VAT number" hint="Optional — shown on tax invoices">
                  <input className="input" value={form.vatNumber} onChange={set('vatNumber')} placeholder="4123456789" />
                </Field>
                <Field label="Company registration no." hint="Optional">
                  <input className="input" value={form.registrationNumber} onChange={set('registrationNumber')} placeholder="2019/123456/07" />
                </Field>
              </div>

              <div className="pt-1">
                <button onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto justify-center gap-2">
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  ) : (
                    <><Save size={15} /> Save company details</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Account info (read-only) */}
          <div className="card p-5 sm:p-6">
            <h3 className="text-sm font-bold text-ink-900 mb-3">Account</h3>
            <div className="text-sm text-ink-600 space-y-1">
              <p><span className="text-ink-400">Signed in as</span> {user?.name}</p>
              <p><span className="text-ink-400">Email</span> {user?.email}</p>
            </div>
          </div>
        </div>

        {/* Live document preview */}
        <div className="lg:col-span-1">
          <p className="section-title mb-2">Preview</p>
          <div className="card overflow-hidden shadow-md">
            {/* Masthead mimics the PDF header */}
            <div className="bg-brand-600 px-4 py-3">
              <p className="text-white font-bold text-base leading-tight truncate">{displayName}</p>
              <p className="text-white/70 text-2xs">Property management · South Africa</p>
            </div>
            <div className="h-1 bg-brass-500" />
            <div className="p-4 text-2xs text-ink-600 space-y-2">
              <div>
                <p className="font-bold text-ink-500 uppercase tracking-widest mb-0.5">From</p>
                <p className="font-semibold text-ink-900">{displayName}</p>
                {form.companyAddress && <p className="whitespace-pre-line">{form.companyAddress}</p>}
                {form.companyEmail && <p>{form.companyEmail}</p>}
                {form.companyPhone && <p>{form.companyPhone}</p>}
                {form.vatNumber && <p>VAT: {form.vatNumber}</p>}
                {form.registrationNumber && <p>Reg: {form.registrationNumber}</p>}
              </div>
              <div className="border-t border-surface-200 pt-2 flex justify-between">
                <span className="text-ink-400">Sample invoice · Rent</span>
                <span className="font-semibold text-ink-900">{formatCurrency(12000)}</span>
              </div>
              <p className="text-ink-400">Due {formatDate(new Date().toISOString().split('T')[0])}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 mt-3 px-1 text-2xs text-ink-500">
            <FileText size={13} className="flex-shrink-0 mt-0.5 text-brand-600" />
            <p>This header appears on downloaded invoice and report PDFs.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
