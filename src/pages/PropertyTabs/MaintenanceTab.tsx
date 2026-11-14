import React, { useState } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal, EmptyState, Field, Select } from '../../components/UI';
import { UpdateMaintenanceModal } from '../../components/UpdateMaintenanceModal';
import { MaintenanceRequest } from '../../types';
import { formatDate, errorMessage } from '../../utils';

interface Props { propertyId: string; }

// ── Maintenance Tab ────────────────────────────────────────
export function MaintenanceTab({ propertyId }: Props) {
  const { maintenanceRequests, addMaintenanceRequest, leases, showToast } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [updating, setUpdating] = useState<MaintenanceRequest | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const activeLease = leases.find(l => l.propertyId === propertyId && l.status === 'active');
  const requests = [...maintenanceRequests.filter(m => m.propertyId === propertyId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const [saving, setSaving] = useState(false);
  const handleAdd = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      await addMaintenanceRequest({
        propertyId,
        leaseId: activeLease?.id,
        tenantId: activeLease?.tenantId,
        title: form.title.trim(),
        description: form.description.trim(),
        status: 'open',
        priority: form.priority as any,
      });
      showToast('Maintenance request added');
      setShowAdd(false);
      setForm({ title: '', description: '', priority: 'medium' });
    } catch (err) {
      showToast(`Couldn't add request: ${errorMessage(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    open:        'bg-gray-100 text-gray-600',
    in_progress: 'bg-amber-50 text-amber-700',
    resolved:    'bg-green-50 text-green-700',
    closed:      'bg-gray-100 text-gray-500',
  };
  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-blue-500', low: 'bg-gray-400',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Maintenance ({requests.length})</h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-3 py-2"><Plus size={14} /> Add request</button>
      </div>

      {requests.length === 0 ? (
        <div className="card">
          <EmptyState icon={<AlertCircle size={22} />} title="No maintenance requests" description="No issues have been logged for this property." action={<button onClick={() => setShowAdd(true)} className="btn-primary">Log request</button>} />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100">
          {requests.map(req => (
            <div key={req.id} className="px-4 py-4">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${priorityDot[req.priority]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{req.title}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[req.status]}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => setUpdating(req)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-surface-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700 font-medium transition-colors"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                  {req.description && <p className="text-xs text-gray-500 mt-1">{req.description}</p>}
                  {req.resolutionNote && (
                    <div className="mt-2 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs font-semibold text-green-700 mb-0.5">Resolution</p>
                      <p className="text-xs text-green-800 leading-relaxed">{req.resolutionNote}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{formatDate(req.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Log maintenance request">
        <div className="p-6 space-y-4">
          <Field label="Title" required>
            <input className="input" placeholder="e.g. Geyser not heating" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Description">
            <textarea className="input resize-none" rows={3} placeholder="Details about the issue…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} options={[
              { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
            ]} />
          </Field>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.title.trim()} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Add request'}</button>
          </div>
        </div>
      </Modal>

      {updating && (
        <UpdateMaintenanceModal request={updating} onClose={() => setUpdating(null)} />
      )}
    </div>
  );
}
