import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal, Field, Select } from './UI';
import { MaintenanceRequest } from '../types';
import { formatDate } from '../utils';

interface Props {
  request: MaintenanceRequest;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'closed',      label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const RESOLVED_STATUSES = new Set(['resolved', 'closed']);

export function UpdateMaintenanceModal({ request, onClose }: Props) {
  const { updateMaintenanceRequest, showToast } = useApp();

  const [status, setStatus]     = useState(request.status);
  const [priority, setPriority] = useState(request.priority);
  const [note, setNote]         = useState(request.resolutionNote || '');
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  // Reset form when request changes
  useEffect(() => {
    setStatus(request.status);
    setPriority(request.priority);
    setNote(request.resolutionNote || '');
    setErrors({});
  }, [request]);

  const isBeingResolved = RESOLVED_STATUSES.has(status);
  const wasAlreadyResolved = RESOLVED_STATUSES.has(request.status);

  const validate = () => {
    const e: Record<string, string> = {};
    if (isBeingResolved && !note.trim()) {
      e.note = 'Please describe how this was resolved before closing.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateMaintenanceRequest(request.id, {
        status,
        priority,
        resolutionNote: note.trim() || undefined,
      });
      showToast(
        status === 'resolved' ? 'Request marked as resolved'
        : status === 'closed' ? 'Request closed'
        : 'Request updated'
      );
      onClose();
    } catch {
      showToast('Failed to update — please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusColor: Record<string, string> = {
    open:        'bg-gray-100 text-gray-600',
    in_progress: 'bg-amber-50 text-amber-700',
    resolved:    'bg-green-50 text-green-700',
    closed:      'bg-gray-100 text-gray-500',
  };
  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-400', low: 'bg-gray-300',
  };

  return (
    <Modal open={true} onClose={onClose} title="Update maintenance request" size="md">
      <div className="p-6 space-y-5">

        {/* Request summary */}
        <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[request.priority]}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-snug">{request.title}</p>
              {request.description && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{request.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1.5">Logged {formatDate(request.createdAt)}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor[request.status]}`}>
              {request.status.replace('_', ' ')}
            </span>
          </div>
          {/* Show existing resolution note if present */}
          {request.resolutionNote && (
            <div className="mt-3 pt-3 border-t border-surface-200">
              <p className="text-xs font-semibold text-gray-500 mb-1">Previous resolution note</p>
              <p className="text-xs text-gray-600 leading-relaxed">{request.resolutionNote}</p>
            </div>
          )}
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select
              value={status}
              onChange={e => setStatus(e.target.value as MaintenanceRequest['status'])}
              options={STATUS_OPTIONS}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              onChange={e => setPriority(e.target.value as MaintenanceRequest['priority'])}
              options={PRIORITY_OPTIONS}
            />
          </Field>
        </div>

        {/* Resolution note */}
        <Field
          label={isBeingResolved ? 'Resolution note' : 'Landlord note (optional)'}
          required={isBeingResolved}
          error={errors.note}
          hint={
            isBeingResolved && !wasAlreadyResolved
              ? 'Describe how the issue was fixed — the tenant can see this.'
              : !isBeingResolved
              ? 'Add any notes about progress or communication with the tenant.'
              : undefined
          }
        >
          <textarea
            className="input resize-none"
            rows={3}
            placeholder={
              isBeingResolved
                ? 'e.g. Plumber replaced the geyser element on 15 Jan. Hot water restored.'
                : 'e.g. Contacted plumber, appointment scheduled for Monday.'
            }
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </Field>

        {/* Resolving banner — shown when moving to resolved/closed */}
        {isBeingResolved && !wasAlreadyResolved && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-green-50 rounded-xl border border-green-100">
            <CheckCircle size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-800 leading-relaxed">
              Marking as <strong>{status}</strong> will notify the tenant that their request has been attended to.
            </p>
          </div>
        )}

        {/* Reopening warning */}
        {wasAlreadyResolved && !RESOLVED_STATUSES.has(status) && (
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 rounded-xl border border-amber-100">
            <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              This request will be re-opened and moved back to <strong>{status.replace('_', ' ')}</strong>.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 justify-center gap-2"
          >
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
              : isBeingResolved && !wasAlreadyResolved
              ? <><CheckCircle size={14} /> Mark {status}</>
              : 'Save update'
            }
          </button>
        </div>
      </div>
    </Modal>
  );
}
