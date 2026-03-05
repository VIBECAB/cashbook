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

  useEffect(() => {
    setLoading(true);
    const [y, m] = month.split('-');
    Promise.all([
      api.getBusiness(businessId),
      api.getTransactions({ business_id: businessId, month: m, year: y, currency })
    ]).then(([biz, txs]) => {
      setBusiness(biz);
      setTransactions(txs);
      if (!business && biz.default_currency) setCurrency(biz.default_currency);
    }).catch(console.error).finally(() => setLoading(false));
  }, [businessId, month, currency]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  const [y, m] = month.split('-');
  const monthName = MONTHS[parseInt(m) - 1];
  const cs = CUR_SYMBOL[currency];

  // For PKR with combined account: show combined account view (Kiddie Tube)
  // For GBP or no combined account: show full income/expense statement
  const isCombinedView = currency === 'PKR' && business?.has_combined_account;

  if (isCombinedView) {
    return <CombinedAccountView transactions={transactions} business={business} cs={cs} monthName={monthName} y={y} month={month} setMonth={setMonth} />;
  }

  return <FullStatementView transactions={transactions} business={business} cs={cs} monthName={monthName} y={y} month={month} setMonth={setMonth} currency={currency} />;
}

function MonthPicker({ month, setMonth }) {
  return <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-auto text-sm" />;
}

function CombinedAccountView({ transactions, business, cs, monthName, y, month, setMonth }) {
  const combinedTxs = transactions.filter(t =>
    (t.type === 'income' && t.source === 'combined') || t.type === 'withdrawal'
  ).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const totalIn = combinedTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = combinedTxs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
  const balance = totalIn - totalOut;

  let runningBalance = 0;
  const rows = combinedTxs.map(t => {
    if (t.type === 'income') runningBalance += t.amount;
    else runningBalance -= t.amount;
    return { ...t, running_balance: runningBalance };
  });

  const partnerWithdrawals = {};
  for (const t of combinedTxs.filter(t => t.type === 'withdrawal')) {
    const name = t.user_name || 'Unknown';
    partnerWithdrawals[name] = (partnerWithdrawals[name] || 0) + t.amount;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Bank Balance</h1>
          <p className="text-sm text-slate-500">{business?.name} - Combined Account (Kiddie Tube)</p>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Money In</p>
          <p className="font-bold text-emerald-600">{cs} {fmt(totalIn)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Withdrawn</p>
          <p className="font-bold text-sky-600">{cs} {fmt(totalOut)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Balance</p>
          <p className={`font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{cs} {fmt(balance)}</p>
        </div>
      </div>

      {Object.keys(partnerWithdrawals).length > 0 && (
        <div className="card mb-5">
          <h2 className="font-semibold mb-3">Withdrawals by Partner</h2>
          <div className="space-y-2">
            {Object.entries(partnerWithdrawals).map(([name, amount]) => {
              const maxW = Math.max(...Object.values(partnerWithdrawals), 1);
              return (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
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
        <h2 className="font-semibold mb-3">{monthName} {y} - Statement</h2>
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No combined account transactions this month</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-left py-2 font-medium">By</th>
                  <th className="text-right py-2 font-medium">In</th>
                  <th className="text-right py-2 font-medium">Out</th>
                  <th className="text-right py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2 text-slate-500">{r.date}</td>
                    <td className="py-2">{r.description || r.type}</td>
                    <td className="py-2 text-slate-500">{r.user_name || '-'}</td>
                    <td className="py-2 text-right font-medium text-emerald-600">
                      {r.type === 'income' ? `${cs} ${fmt(r.amount)}` : ''}
                    </td>
                    <td className="py-2 text-right font-medium text-sky-600">
                      {r.type === 'withdrawal' ? `${cs} ${fmt(r.amount)}` : ''}
                    </td>
                    <td className={`py-2 text-right font-bold ${r.running_balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {cs} {fmt(r.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold">
                  <td colSpan="3" className="py-2">Total</td>
                  <td className="py-2 text-right text-emerald-600">{cs} {fmt(totalIn)}</td>
                  <td className="py-2 text-right text-sky-600">{cs} {fmt(totalOut)}</td>
                  <td className={`py-2 text-right ${balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{cs} {fmt(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FullStatementView({ transactions, business, cs, monthName, y, month, setMonth, currency }) {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const totalIn = sorted.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = sorted.filter(t => t.type === 'expense' || t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
  const balance = totalIn - totalOut;

  let runningBalance = 0;
  const rows = sorted.map(t => {
    if (t.type === 'income') runningBalance += t.amount;
    else runningBalance -= t.amount;
    return { ...t, running_balance: runningBalance };
  });

  // Breakdown by partner
  const partnerTotals = {};
  for (const t of sorted) {
    const name = t.user_name || (t.source === 'combined' ? 'Combined' : 'Unknown');
    if (!partnerTotals[name]) partnerTotals[name] = { income: 0, expenses: 0 };
    if (t.type === 'income') partnerTotals[name].income += t.amount;
    else partnerTotals[name].expenses += t.amount;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Bank Balance</h1>
          <p className="text-sm text-slate-500">{business?.name} - {currency === 'GBP' ? 'GBP Account' : 'Account Statement'}</p>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Income</p>
          <p className="font-bold text-emerald-600">{cs} {fmt(totalIn)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Expenses</p>
          <p className="font-bold text-red-600">{cs} {fmt(totalOut)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Balance</p>
          <p className={`font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{cs} {fmt(balance)}</p>
        </div>
      </div>

      {/* Partner breakdown */}
      {Object.keys(partnerTotals).length > 0 && (
        <div className="card mb-5">
          <h2 className="font-semibold mb-3">By Partner</h2>
          <div className="space-y-2">
            {Object.entries(partnerTotals).map(([name, totals]) => (
              <div key={name} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span>{name}</span>
                <div className="flex gap-4">
                  <span className="text-emerald-600 font-medium">{cs} {fmt(totals.income)} in</span>
                  <span className="text-red-600 font-medium">{cs} {fmt(totals.expenses)} out</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-3">{monthName} {y} - Statement</h2>
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No transactions this month</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-left py-2 font-medium">By</th>
                  <th className="text-right py-2 font-medium">In</th>
                  <th className="text-right py-2 font-medium">Out</th>
                  <th className="text-right py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2 text-slate-500">{r.date}</td>
                    <td className="py-2">{r.description || r.category || r.type}</td>
                    <td className="py-2 text-slate-500">{r.user_name || (r.source === 'combined' ? 'Combined' : '-')}</td>
                    <td className="py-2 text-right font-medium text-emerald-600">
                      {r.type === 'income' ? `${cs} ${fmt(r.amount)}` : ''}
                    </td>
                    <td className="py-2 text-right font-medium text-red-600">
                      {(r.type === 'expense' || r.type === 'withdrawal') ? `${cs} ${fmt(r.amount)}` : ''}
                    </td>
                    <td className={`py-2 text-right font-bold ${r.running_balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {cs} {fmt(r.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold">
                  <td colSpan="3" className="py-2">Total</td>
                  <td className="py-2 text-right text-emerald-600">{cs} {fmt(totalIn)}</td>
                  <td className="py-2 text-right text-red-600">{cs} {fmt(totalOut)}</td>
                  <td className={`py-2 text-right ${balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{cs} {fmt(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
