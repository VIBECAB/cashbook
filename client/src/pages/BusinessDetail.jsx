import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const CATEGORIES = ['', 'Rent', 'Utilities', 'Supplies', 'Salary', 'Transport', 'Food', 'Marketing', 'Employee Budget', 'Employee Advance', 'Miscellaneous'];
const CUR_SYMBOL = { PKR: 'Rs', GBP: '\u00a3' };

export default function BusinessDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [currency, setCurrency] = useState('PKR');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [form, setForm] = useState({
    type: 'expense',
    source: 'personal',
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingTx, setEditingTx] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const fetchData = () => {
    const [y, m] = month.split('-');
    Promise.all([
      api.getBusiness(id),
      api.getTransactions({ business_id: id, month: m, year: y, currency })
    ]).then(([biz, txs]) => {
      setBusiness(biz);
      setTransactions(txs);
      if (!business && biz.default_currency) setCurrency(biz.default_currency);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [id, month, currency]);

  useEffect(() => {
    if (showForm && (form.category === 'Employee Budget' || form.category === 'Employee Advance')) {
      api.getEmployees(id).then(emps => setEmployees(emps.filter(e => e.active))).catch(console.error);
    }
  }, [showForm, form.category, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingTx) {
        await api.updateTransaction(editingTx.id, { amount: parseFloat(form.amount), description: form.description, category: form.category, date: form.date });
        setEditingTx(null);
      } else if (form.category === 'Employee Budget' && selectedEmployee && form.type === 'expense') {
        await api.giveBudget(selectedEmployee, { amount: parseFloat(form.amount), description: form.description, date: form.date, business_id: id });
        setSelectedEmployee('');
      } else if (form.category === 'Employee Advance' && selectedEmployee && form.type === 'expense') {
        await api.giveAdvance(selectedEmployee, { amount: parseFloat(form.amount), description: form.description, date: form.date, business_id: id });
        setSelectedEmployee('');
      } else {
        await api.addTransaction({ ...form, business_id: id, amount: parseFloat(form.amount), currency });
      }
      setForm({ type: 'expense', source: 'personal', amount: '', description: '', category: '', date: new Date().toISOString().split('T')[0] });
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tx) => {
    setEditingTx(tx);
    setForm({ type: tx.type, source: tx.source, amount: tx.amount.toString(), description: tx.description, category: tx.category, date: tx.date });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingTx(null);
    setForm({ type: 'expense', source: 'personal', amount: '', description: '', category: '', date: new Date().toISOString().split('T')[0] });
    setError('');
  };

  const handleDelete = async (txId) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.deleteTransaction(txId);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  const cs = CUR_SYMBOL[currency];
  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + parseFloat(t.amount), 0);
  const combinedIncome = transactions.filter(t => t.type === 'income' && t.source === 'combined').reduce((s, t) => s + parseFloat(t.amount), 0);
  const combinedBalance = combinedIncome - totalWithdrawals;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">{business?.name}</h1>
          <p className="text-sm text-slate-500">
            Partners: {business?.partners?.map(p => p.name).join(', ')}
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input w-auto text-sm"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card text-center py-3 px-2">
          <p className="text-xs text-slate-500">Income</p>
          <p className="font-bold text-emerald-600 text-sm">{cs} {fmt(totalIncome)}</p>
        </div>
        <div className="card text-center py-3 px-2">
          <p className="text-xs text-slate-500">Expenses</p>
          <p className="font-bold text-red-600 text-sm">{cs} {fmt(totalExpenses)}</p>
        </div>
        <div className="card text-center py-3 px-2">
          <p className="text-xs text-slate-500">{totalIncome - totalExpenses >= 0 ? 'Profit' : 'Loss'}</p>
          <p className={`font-bold text-sm ${totalIncome - totalExpenses >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {cs} {fmt(Math.abs(totalIncome - totalExpenses))}
          </p>
        </div>
      </div>

      {/* Combined Account Balance */}
      {business?.has_combined_account && combinedIncome > 0 && (
        <div className="card mb-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Combined Account (Kiddie Tube)</p>
            <p className="text-xs text-slate-400">Income: {cs} {fmt(combinedIncome)} | Withdrawn: {cs} {fmt(totalWithdrawals)}</p>
          </div>
          <p className={`font-bold ${combinedBalance >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
            Balance: {cs} {fmt(combinedBalance)}
          </p>
        </div>
      )}

      {/* Add Transaction Button / Form */}
      {!showForm ? (
        <button onClick={() => { setEditingTx(null); setShowForm(true); }} className="btn-primary w-full mb-5">
          + Add Transaction
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="card mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{editingTx ? 'Edit Transaction' : 'New Transaction'}</h3>
            <button type="button" onClick={cancelForm} className="text-slate-400 hover:text-slate-600 text-sm">Cancel</button>
          </div>
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                {business?.has_combined_account && <option value="withdrawal">Withdrawal (from Combined)</option>}
              </select>
            </div>
            {form.type === 'income' && business?.has_combined_account ? (
              <div>
                <label className="label">Source</label>
                <select className="input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                  <option value="personal">Personal (You)</option>
                  <option value="combined">Combined Account</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c || 'Select category'}</option>)}
                </select>
              </div>
            )}
          </div>

          {form.type === 'income' && business?.has_combined_account && (
            <div className="mb-3">
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c || 'Select category'}</option>)}
              </select>
            </div>
          )}

          {(form.category === 'Employee Budget' || form.category === 'Employee Advance') && form.type === 'expense' && !editingTx && (
            <div className="mb-3">
              <label className="label">Employee</label>
              <select className="input" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} required>
                <option value="">Select employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
              {employees.length === 0 && <p className="text-xs text-slate-400 mt-1">No active employees. Add one from the Employees tab.</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Amount ({cs})</label>
              <input type="number" className="input" placeholder="0" min="1" step="any" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Description</label>
            <input type="text" className="input" placeholder="What's this for?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" disabled={submitting} className={form.type === 'income' ? 'btn-success w-full' : form.type === 'withdrawal' ? 'btn-primary w-full' : 'btn-danger w-full'}>
            {submitting ? 'Saving...' : `Add ${form.type === 'income' ? 'Income' : form.type === 'withdrawal' ? 'Withdrawal' : 'Expense'}`}
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'income', 'expense', ...(business?.has_combined_account ? ['withdrawal'] : [])].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'income' ? 'Income' : f === 'withdrawal' ? 'Withdrawals' : 'Expenses'}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card text-center text-slate-400 py-8">No transactions for this month</div>
        )}
        {filtered.map(tx => (
          <div key={tx.id} className="card py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.type === 'income' ? 'bg-emerald-500' : tx.type === 'withdrawal' ? 'bg-sky-500' : 'bg-red-500'}`}></span>
                <span className="font-medium text-sm truncate">{tx.description || tx.category || tx.type}</span>
                {tx.type === 'withdrawal' && <span className="badge bg-sky-50 text-sky-600">Withdrawal</span>}
              </div>
              <div className="text-xs text-slate-400 ml-4 flex flex-wrap gap-x-2">
                <span>{tx.type === 'withdrawal' ? `${tx.user_name} from Combined` : tx.source === 'combined' ? 'Combined Account' : tx.user_name}</span>
                {tx.category && <span>&middot; {tx.category}</span>}
                <span>&middot; {tx.date}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className={`font-semibold text-sm ${tx.type === 'income' ? 'text-emerald-600' : tx.type === 'withdrawal' ? 'text-sky-600' : 'text-red-600'}`}>
                {tx.type === 'income' ? '+' : '-'}{cs} {fmt(tx.amount)}
              </span>
              {(tx.user_id === user.id || tx.source === 'combined') && (
                <>
                  <button onClick={() => handleEdit(tx)} className="text-slate-300 hover:text-blue-500 transition-colors p-1" title="Edit">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
