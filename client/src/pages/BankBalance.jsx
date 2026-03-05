import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CUR_SYMBOL = { PKR: 'Rs', GBP: '\u00a3' };

export default function BankBalance() {
  const { id: businessId } = useParams();
  const [business, setBusiness] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('PKR');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchData = () => {
    const [y, m] = month.split('-');
    Promise.all([
      api.getBusiness(businessId),
      api.getTransactions({ business_id: businessId, month: m, year: y, currency })
    ]).then(([biz, txs]) => {
      setBusiness(biz);
      setTransactions(txs);
      if (!business && biz.default_currency) setCurrency(biz.default_currency);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [businessId, month, currency]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  const [y, m] = month.split('-');
  const monthName = MONTHS[parseInt(m) - 1];
  const cs = CUR_SYMBOL[currency];

  const isCombinedView = currency === 'PKR' && business?.has_combined_account;

  if (isCombinedView) {
    return <CombinedAccountView transactions={transactions} business={business} cs={cs} monthName={monthName} y={y} month={month} setMonth={setMonth} businessId={businessId} currency={currency} fetchData={fetchData} />;
  }

  return <FullStatementView transactions={transactions} business={business} cs={cs} monthName={monthName} y={y} month={month} setMonth={setMonth} currency={currency} businessId={businessId} fetchData={fetchData} />;
}

function MonthPicker({ month, setMonth }) {
  return <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-auto text-xs" />;
}

function AddBankTransactionForm({ businessId, currency, isCombined, cs, onDone }) {
  const [type, setType] = useState(isCombined ? 'deposit' : 'income');
  const [form, setForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const txData = {
        business_id: businessId,
        amount: parseFloat(form.amount),
        description: form.description,
        date: form.date,
        currency,
        category: 'Bank'
      };

      if (isCombined) {
        if (type === 'deposit') {
          txData.type = 'income';
          txData.source = 'combined';
        } else {
          txData.type = 'withdrawal';
          txData.source = 'personal';
        }
      } else {
        txData.type = type;
        txData.source = 'personal';
      }

      await api.addTransaction(txData);
      setForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-4">
      <h3 className="font-semibold text-sm mb-3">Add Bank Transaction</h3>
      {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setType(isCombined ? 'deposit' : 'income')}
          className={`py-2.5 rounded-lg text-xs font-medium border-2 transition-colors ${
            (isCombined ? type === 'deposit' : type === 'income')
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 text-slate-600'
          }`}
        >
          {isCombined ? 'Deposit' : 'Money In'}
        </button>
        <button
          type="button"
          onClick={() => setType(isCombined ? 'withdrawal' : 'expense')}
          className={`py-2.5 rounded-lg text-xs font-medium border-2 transition-colors ${
            (isCombined ? type === 'withdrawal' : type === 'expense')
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-slate-200 text-slate-600'
          }`}
        >
          {isCombined ? 'Withdrawal' : 'Money Out'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="label text-xs">Amount ({cs})</label>
          <input type="number" className="input text-sm" required min="1" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="label text-xs">Date</label>
          <input type="date" className="input text-sm" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </div>
      </div>
      <div className="mb-3">
        <label className="label text-xs">Description</label>
        <input className="input text-sm" placeholder="Bank deposit, transfer, etc." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className={`flex-1 py-3 ${(isCombined ? type === 'deposit' : type === 'income') ? 'btn-success' : 'btn-danger'}`}>
          {submitting ? 'Saving...' : `Add ${isCombined ? (type === 'deposit' ? 'Deposit' : 'Withdrawal') : (type === 'income' ? 'Money In' : 'Money Out')}`}
        </button>
        <button type="button" onClick={onDone} className="btn-outline">Cancel</button>
      </div>
    </form>
  );
}

function CombinedAccountView({ transactions, business, cs, monthName, y, month, setMonth, businessId, currency, fetchData }) {
  const [showForm, setShowForm] = useState(false);

  const combinedTxs = transactions.filter(t =>
    (t.type === 'income' && t.source === 'combined') || t.type === 'withdrawal'
  ).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const totalIn = combinedTxs.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = combinedTxs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance = totalIn - totalOut;

  let runningBalance = 0;
  const rows = combinedTxs.map(t => {
    if (t.type === 'income') runningBalance += parseFloat(t.amount);
    else runningBalance -= parseFloat(t.amount);
    return { ...t, running_balance: runningBalance };
  });

  const partnerWithdrawals = {};
  for (const t of combinedTxs.filter(t => t.type === 'withdrawal')) {
    const name = t.user_name || 'Unknown';
    partnerWithdrawals[name] = (partnerWithdrawals[name] || 0) + parseFloat(t.amount);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Bank Balance</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">{business?.name} - Combined Account</p>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500">Money In</p>
          <p className="font-bold text-emerald-600 text-xs sm:text-sm">{cs} {fmt(totalIn)}</p>
        </div>
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500">Withdrawn</p>
          <p className="font-bold text-sky-600 text-xs sm:text-sm">{cs} {fmt(totalOut)}</p>
        </div>
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500">Balance</p>
          <p className={`font-bold text-xs sm:text-sm ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{cs} {fmt(balance)}</p>
        </div>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary w-full mb-4 py-3 text-sm">
          + Add Bank Transaction
        </button>
      ) : (
        <AddBankTransactionForm
          businessId={businessId}
          currency={currency}
          isCombined={true}
          cs={cs}
          onDone={() => { setShowForm(false); fetchData(); }}
        />
      )}

      {Object.keys(partnerWithdrawals).length > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-sm mb-3">Withdrawals by Partner</h2>
          <div className="space-y-2">
            {Object.entries(partnerWithdrawals).map(([name, amount]) => {
              const maxW = Math.max(...Object.values(partnerWithdrawals), 1);
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs sm:text-sm mb-1">
                    <span>{name}</span>
                    <span className="font-medium">{cs} {fmt(amount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-sky-500 h-2 rounded-full transition-all" style={{ width: `${(amount / maxW) * 100}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-sm mb-3">{monthName} {y} - Statement</h2>
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No combined account transactions this month</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-xs sm:text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[10px] sm:text-xs">
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-1 font-medium">Description</th>
                  <th className="text-left py-2 px-1 font-medium">By</th>
                  <th className="text-right py-2 px-1 font-medium">In</th>
                  <th className="text-right py-2 px-1 font-medium">Out</th>
                  <th className="text-right py-2 px-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2 px-3 text-slate-500">{r.date}</td>
                    <td className="py-2 px-1">{r.description || r.type}</td>
                    <td className="py-2 px-1 text-slate-500">{r.user_name || '-'}</td>
                    <td className="py-2 px-1 text-right font-medium text-emerald-600">
                      {r.type === 'income' ? `${cs} ${fmt(parseFloat(r.amount))}` : ''}
                    </td>
                    <td className="py-2 px-1 text-right font-medium text-sky-600">
                      {r.type === 'withdrawal' ? `${cs} ${fmt(parseFloat(r.amount))}` : ''}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${r.running_balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {cs} {fmt(r.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold text-xs sm:text-sm">
                  <td colSpan="3" className="py-2 px-3">Total</td>
                  <td className="py-2 px-1 text-right text-emerald-600">{cs} {fmt(totalIn)}</td>
                  <td className="py-2 px-1 text-right text-sky-600">{cs} {fmt(totalOut)}</td>
                  <td className={`py-2 px-3 text-right ${balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{cs} {fmt(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FullStatementView({ transactions, business, cs, monthName, y, month, setMonth, currency, businessId, fetchData }) {
  const [showForm, setShowForm] = useState(false);

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const totalIn = sorted.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = sorted.filter(t => t.type === 'expense' || t.type === 'withdrawal').reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance = totalIn - totalOut;

  let runningBalance = 0;
  const rows = sorted.map(t => {
    if (t.type === 'income') runningBalance += parseFloat(t.amount);
    else runningBalance -= parseFloat(t.amount);
    return { ...t, running_balance: runningBalance };
  });

  const partnerTotals = {};
  for (const t of sorted) {
    const name = t.user_name || (t.source === 'combined' ? 'Combined' : 'Unknown');
    if (!partnerTotals[name]) partnerTotals[name] = { income: 0, expenses: 0 };
    if (t.type === 'income') partnerTotals[name].income += parseFloat(t.amount);
    else partnerTotals[name].expenses += parseFloat(t.amount);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Bank Balance</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">{business?.name} - {currency === 'GBP' ? 'GBP Account' : 'Account Statement'}</p>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500">Income</p>
          <p className="font-bold text-emerald-600 text-xs sm:text-sm">{cs} {fmt(totalIn)}</p>
        </div>
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500">Expenses</p>
          <p className="font-bold text-red-600 text-xs sm:text-sm">{cs} {fmt(totalOut)}</p>
        </div>
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500">Balance</p>
          <p className={`font-bold text-xs sm:text-sm ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{cs} {fmt(balance)}</p>
        </div>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary w-full mb-4 py-3 text-sm">
          + Add Bank Transaction
        </button>
      ) : (
        <AddBankTransactionForm
          businessId={businessId}
          currency={currency}
          isCombined={false}
          cs={cs}
          onDone={() => { setShowForm(false); fetchData(); }}
        />
      )}

      {Object.keys(partnerTotals).length > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold text-sm mb-3">By Partner</h2>
          <div className="space-y-2">
            {Object.entries(partnerTotals).map(([name, totals]) => (
              <div key={name} className="flex justify-between text-xs sm:text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span>{name}</span>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-medium">{cs} {fmt(totals.income)} in</span>
                  <span className="text-red-600 font-medium">{cs} {fmt(totals.expenses)} out</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-sm mb-3">{monthName} {y} - Statement</h2>
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No transactions this month</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-xs sm:text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[10px] sm:text-xs">
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-1 font-medium">Description</th>
                  <th className="text-left py-2 px-1 font-medium">By</th>
                  <th className="text-right py-2 px-1 font-medium">In</th>
                  <th className="text-right py-2 px-1 font-medium">Out</th>
                  <th className="text-right py-2 px-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2 px-3 text-slate-500">{r.date}</td>
                    <td className="py-2 px-1">{r.description || r.category || r.type}</td>
                    <td className="py-2 px-1 text-slate-500">{r.user_name || (r.source === 'combined' ? 'Combined' : '-')}</td>
                    <td className="py-2 px-1 text-right font-medium text-emerald-600">
                      {r.type === 'income' ? `${cs} ${fmt(parseFloat(r.amount))}` : ''}
                    </td>
                    <td className="py-2 px-1 text-right font-medium text-red-600">
                      {(r.type === 'expense' || r.type === 'withdrawal') ? `${cs} ${fmt(parseFloat(r.amount))}` : ''}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${r.running_balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {cs} {fmt(r.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold text-xs sm:text-sm">
                  <td colSpan="3" className="py-2 px-3">Total</td>
                  <td className="py-2 px-1 text-right text-emerald-600">{cs} {fmt(totalIn)}</td>
                  <td className="py-2 px-1 text-right text-red-600">{cs} {fmt(totalOut)}</td>
                  <td className={`py-2 px-3 text-right ${balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{cs} {fmt(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
