import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import ChangePassword from '../components/ChangePassword';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function EmployeePanel() {
  const { user, logout } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPwModal, setShowPwModal] = useState(false);

  const fetchData = () => {
    Promise.all([
      api.getEmployeeBudgets(user.id),
      api.getEmployeeExpenses(user.id)
    ]).then(([b, e]) => {
      setBudgets(b);
      setExpenses(e);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = totalBudget - totalSpent;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.addEmployeeExpense(user.id, {
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date
      });
      setForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <span className="font-bold">Cashbook</span>
            <span className="text-xs text-slate-400 ml-2">{user.business_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPwModal(true)} className="text-sm text-slate-300 hover:text-white transition-colors">{user.name}</button>
            <button onClick={logout} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md">Logout</button>
          </div>
        </div>
      </header>

      {showPwModal && <ChangePassword onClose={() => setShowPwModal(false)} />}

      <main className="max-w-lg mx-auto px-4 py-5">
        {/* Budget Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="card text-center py-3">
            <p className="text-xs text-slate-500">Budget</p>
            <p className="font-bold text-sm">Rs {fmt(totalBudget)}</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xs text-slate-500">Spent</p>
            <p className="font-bold text-red-600 text-sm">Rs {fmt(totalSpent)}</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xs text-slate-500">Remaining</p>
            <p className={`font-bold text-sm ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rs {fmt(remaining)}</p>
          </div>
        </div>

        {/* Add Expense */}
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="btn-danger w-full mb-5">+ Add Expense</button>
        ) : (
          <form onSubmit={handleSubmit} className="card mb-5">
            <h3 className="font-semibold mb-3">New Expense</h3>
            {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}
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
            <div className="mb-3">
              <label className="label">Description</label>
              <input className="input" placeholder="What did you spend on?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn-danger flex-1">{submitting ? 'Saving...' : 'Add Expense'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
            </div>
          </form>
        )}

        {/* Budgets Received */}
        <div className="card mb-5">
          <h3 className="font-semibold mb-3">Budgets Received</h3>
          {budgets.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-3">No budgets received yet</p>
          ) : (
            <div className="space-y-2">
              {budgets.map(b => (
                <div key={b.id} className="flex justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
                  <div>
                    <p className="font-medium">Rs {fmt(b.amount)}</p>
                    <p className="text-xs text-slate-400">From {b.partner_name} {b.description ? `- ${b.description}` : ''}</p>
                  </div>
                  <span className="text-xs text-slate-400 self-center">{b.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="card">
          <h3 className="font-semibold mb-3">My Expenses</h3>
          {expenses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-3">No expenses posted yet</p>
          ) : (
            <div className="space-y-2">
              {expenses.map(e => (
                <div key={e.id} className="flex justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
                  <div>
                    <p className="font-medium text-red-600">Rs {fmt(e.amount)}</p>
                    <p className="text-xs text-slate-400">{e.description || 'No description'}</p>
                  </div>
                  <span className="text-xs text-slate-400 self-center">{e.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
