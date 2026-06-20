import React, { ReactNode, useState, useRef } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Toast } from '../types';

// ── Modal ──────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop"
      style={{ background: 'rgba(15,18,35,0.55)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-white w-full ${widths[size]} rounded-t-3xl sm:rounded-2xl shadow-2xl modal-content flex flex-col`} style={{ maxHeight: 'min(92dvh, 92vh)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────
interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Toast Container ────────────────────────────────────────
// Accepts optional toasts/dismissToast — falls back to AppContext for the landlord portal.
// Tenant portal explicitly passes its own toasts.
interface ToastContainerProps {
  toasts?: Toast[];
  dismissToast?: (id: string) => void;
}

export function ToastContainer({ toasts: propToasts, dismissToast: propDismiss }: ToastContainerProps = {}) {
  // Use props if provided, otherwise fall back to AppContext
  const app = (propToasts === undefined) ? useApp() : null;
  const toasts = propToasts ?? app?.toasts ?? [];
  const dismissToast = propDismiss ?? app?.dismissToast ?? (() => {});

  const icons: Record<Toast['type'], ReactNode> = {
    success: <CheckCircle size={16} className="text-brand-700" />,
    error:   <AlertCircle size={16} className="text-red-600" />,
    warning: <AlertTriangle size={16} className="text-amber-600" />,
    info:    <Info size={16} className="text-brand-700" />,
  };
  const bg: Record<Toast['type'], string> = {
    success: 'bg-brand-50 border-brand-200',
    error:   'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info:    'bg-brand-50 border-brand-200',
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-md ${bg[t.type]} toast-enter pointer-events-auto`}
        >
          {icons[t.type]}
          <span className="text-sm text-ink-800 flex-1 font-medium">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="p-0.5 rounded hover:opacity-70"
            aria-label="Dismiss notification"
          >
            <X size={14} className="text-ink-500" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-4 text-gray-400">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-6">{description}</p>
      {action}
    </div>
  );
}

// ── Form Field ─────────────────────────────────────────────
interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  hint?: string;
}

export function Field({ label, required, error, children, hint }: FieldProps) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export function Select({ options, placeholder, className = '', ...props }: SelectProps) {
  return (
    <select className={`input ${className}`} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Toggle ─────────────────────────────────────────────────
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-brand-600' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`} />
      </div>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

// ── Status Badge ───────────────────────────────────────────
interface BadgeProps { status: string; label?: string; }
export function StatusBadge({ status, label }: BadgeProps) {
  const cls = {
    active: 'badge-green', paid: 'badge-green', verified: 'badge-green', resolved: 'badge-green', accepted: 'badge-green', complete: 'badge-green',
    sent: 'badge-amber', pending: 'badge-amber', in_progress: 'badge-amber', processing: 'badge-amber',
    partial: 'badge-amber',
    overdue: 'badge-red', failed: 'badge-red',
    draft: 'badge-gray', ended: 'badge-gray', open: 'badge-gray', closed: 'badge-gray', none: 'badge-gray',
  }[status] || 'badge-gray';
  const labels: Record<string, string> = {
    active: 'Active', paid: 'Paid', verified: 'Verified', resolved: 'Resolved', accepted: 'Accepted', complete: 'Complete',
    sent: 'Sent', pending: 'Pending', in_progress: 'In progress', processing: 'Processing',
    partial: 'Partial',
    overdue: 'Overdue', failed: 'Failed',
    draft: 'Draft', ended: 'Ended', open: 'Open', closed: 'Closed', none: 'Not invited',
  };
  return <span className={cls}>{label || labels[status] || status}</span>;
}

// ── Priority Badge ─────────────────────────────────────────
export function PriorityBadge({ priority }: { priority: string }) {
  const cls = { urgent: 'badge-red', high: 'badge-amber', medium: 'badge-blue', low: 'badge-gray' }[priority] || 'badge-gray';
  return <span className={cls}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>;
}

// ── Loading Spinner ────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

// ── Page Header ────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: ReactNode;
}

export function PageHeader({ title, subtitle, action, back }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        {back}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  color?: string;
  onClick?: () => void;
}

export function StatCard({ title, value, sub, icon, color = 'bg-brand-50 text-brand-700', onClick }: StatCardProps) {
  return (
    <div className={`stat-card ${onClick ? 'cursor-pointer card-lift' : ''}`} onClick={onClick}>
      {icon && (
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
          {icon}
        </div>
      )}
      <p className="text-xs text-gray-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── File upload area ───────────────────────────────────────
interface FileUploadProps {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
}

export function FileUpload({ onFile, accept = '.pdf', label = 'Upload PDF' }: FileUploadProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        dragging ? 'border-brand-400 bg-brand-50' : 'border-surface-300 hover:border-brand-300'
      }`}
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="text-gray-400 mb-2">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mt-1">Drag & drop or click to browse</p>
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────
interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-surface-200 overflow-x-auto gap-0 -mb-px">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`tab ${active === t.id ? 'tab-active' : 'tab-inactive'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
