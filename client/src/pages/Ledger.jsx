import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function Ledger() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    partner_id: '',
    type: 'credit',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const fetchSummary = () => {
    api.getLedgerSummary()
      .then(setSummaries)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchEntries = (partnerId) => {
    api.getLedger(partnerId).then(setEntries).catch(console.error);
  };

  useEffect(() => { fetchSummary(); }, []);

  useEffect(() => {
    if (selectedPartner) fetchEntries(selectedPartner.partner_id);
  }, [selectedPartner]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingEntry) {
        await api.updateLedgerEntry(editingEntry.id, {
          type: form.type,
          amount: parseFloat(form.amount),
          description: form.description,
          date: form.date
        });
        setEditingEntry(null);
      } else {
        await api.addLedgerEntry({
          partner_id: parseInt(form.partner_id),
          type: form.type,
          amount: parseFloat(form.amount),
          description: form.description,
          date: form.date
        });
      }
      setForm({ partner_id: '', type: 'credit', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setShowForm(false);
      fetchSummary();
      if (selectedPartner) fetchEntries(selectedPartner.partner_id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setForm({
      partner_id: entry.partner_id.toString(),
      type: entry.type,
      amount: entry.amount.toString(),
      description: entry.description,
      date: entry.date
    });
    setShowForm(true);
  };

  const handleDelete = async (entryId) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.deleteLedgerEntry(entryId);
      fetchSummary();
      if (selectedPartner) fetchEntries(selectedPartner.partner_id);
    } catch (err) {
      alert(err.message);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingEntry(null);
    setForm({ partner_id: '', type: 'credit', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    setError('');
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Partner Ledger</h1>
          <p className="text-sm text-slate-500">Track credit & debit between partners</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingEntry(null); }} className="btn-primary text-sm">
          + Add Entry
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{editingEntry ? 'Edit Entry' : 'New Entry'}</h3>
            <button type="button" onClick={cancelForm} className="text-slate-400 hover:text-slate-600 text-sm">Cancel</button>
          </div>
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}

          {!editingEntry && (
            <div className="mb-3">
              <label className="label">Partner</label>
              <select className="input" required value={form.partner_id} onChange={e => setForm({ ...form, partner_id: e.target.value })}>
                <option value="">Select partner</option>
                {summaries.map(s => (
                  <option key={s.partner_id} value={s.partner_id}>{s.partner_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-3">
            <label className="label">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'credit' })}
                className={`py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                  form.type === 'credit'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                They owe me
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: 'debit' })}
                className={`py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                  form.type === 'debit'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                I owe them
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Amount (Rs)</label>
              <input type="number" className="input" required min="1" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Description / Reason</label>
            <input className="input" placeholder="What is this for?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">
            {editingEntry ? 'Update Entry' : 'Add Entry'}
          </button>
        </form>
      )}

      {/* Partner Balance Cards */}
      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        {summaries.map(s => (
          <div
            key={s.partner_id}
            onClick={() => setSelectedPartner(s)}
            className={`card cursor-pointer hover:shadow-md transition-shadow ${
              selectedPartner?.partner_id === s.partner_id ? 'ring-2 ring-slate-800' : ''
            }`}
          >
            <h3 className="font-bold text-lg mb-3">{s.partner_name}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <p className="text-slate-500 text-xs">They owe you</p>
                <p className="font-semibold text-blue-600">Rs {fmt(s.they_owe_me)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">You owe them</p>
                <p className="font-semibold text-orange-600">Rs {fmt(s.i_owe_them)}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">Net Balance</p>
              <p className={`font-bold text-lg ${s.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {s.net >= 0
                  ? `${s.partner_name} owes you Rs ${fmt(s.net)}`
                  : `You owe ${s.partner_name} Rs ${fmt(Math.abs(s.net))}`
                }
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Entries Detail */}
      {selectedPartner && (
        <div className="card">
          <h2 className="font-bold mb-1">Ledger with {selectedPartner.partner_name}</h2>
          <p className="text-xs text-slate-400 mb-4">
            Your entries are editable. Entries by {selectedPartner.partner_name} are view-only.
          </p>

          {entries.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No entries yet</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => {
                const isMine = entry.created_by === user.id;
                // Determine what this entry means from my perspective
                let label, color;
                if (isMine) {
                  if (entry.type === 'credit') {
                    label = `${entry.partner_name} owes you`;
                    color = 'text-blue-600';
                  } else {
                    label = `You owe ${entry.partner_name}`;
                    color = 'text-orange-600';
                  }
                } else {
                  if (entry.type === 'credit') {
                    label = `You owe ${entry.created_by_name}`;
                    color = 'text-orange-600';
                  } else {
                    label = `${entry.created_by_name} owes you`;
                    color = 'text-blue-600';
                  }
                }

                return (
                  <div key={entry.id} className={`flex items-start justify-between py-3 border-b border-slate-50 last:border-0 ${!isMine ? 'bg-slate-50 -mx-5 px-5 rounded-lg' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm font-semibold ${color}`}>Rs {fmt(entry.amount)}</span>
                        <span className={`text-xs ${color}`}>{label}</span>
                      </div>
                      {entry.description && (
                        <p className="text-sm text-slate-600 mb-0.5">{entry.description}</p>
                      )}
                      <div className="text-xs text-slate-400">
                        {entry.date} &middot; Added by {entry.created_by_name}
                        {!isMine && <span className="ml-1 text-slate-300">(view only)</span>}
                      </div>
                    </div>
                    {isMine && (
                      <div className="flex gap-1 ml-3 flex-shrink-0">
                        <button onClick={() => handleEdit(entry)} className="text-slate-400 hover:text-blue-500 transition-colors p-1" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
