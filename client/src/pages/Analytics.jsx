import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CUR_SYMBOL = { PKR: 'Rs', GBP: '\u00a3' };

export default function Analytics() {
  const { id: businessId } = useParams();
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [data, setData] = useState(null);
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
      api.getAnalytics({ business_id: businessId, month: m, year: y, currency })
    ]).then(([biz, analytics]) => {
      setBusiness(biz);
      setData(analytics);
      if (!business && biz.default_currency) setCurrency(biz.default_currency);
    }).catch(console.error).finally(() => setLoading(false));
  }, [businessId, month, currency]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  const [y, m] = month.split('-');
  const monthName = MONTHS[parseInt(m) - 1];
  const cs = CUR_SYMBOL[currency];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">{business?.name} - Analytics</h1>
          <p className="text-sm text-slate-500">{monthName} {y}</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-auto text-sm" />
      </div>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-xs text-slate-500 mb-1">Total Income</p>
          <p className="text-lg font-bold text-emerald-600">{cs} {fmt(data?.total_income || 0)}</p>
          {data?.combined_income > 0 && (
            <p className="text-xs text-slate-400 mt-1">Combined: {cs} {fmt(data.combined_income)}</p>
          )}
        </div>
        <div className="card text-center">
          <p className="text-xs text-slate-500 mb-1">Total Expenses</p>
          <p className="text-lg font-bold text-red-600">{cs} {fmt(data?.total_expenses || 0)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-slate-500 mb-1">{(data?.profit || 0) >= 0 ? 'Profit' : 'Loss'}</p>
          <p className={`text-lg font-bold ${(data?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {cs} {fmt(Math.abs(data?.profit || 0))}
          </p>
        </div>
      </div>

      {/* Combined Account Balance */}
      {data?.combined_income > 0 && (
        <div className="card mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold">Combined Account (Kiddie Tube)</p>
            <p className="text-xs text-slate-400">Income: {cs} {fmt(data.combined_income)} | Withdrawn: {cs} {fmt(data.total_withdrawals || 0)}</p>
          </div>
          <p className={`text-lg font-bold ${(data.combined_balance || 0) >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
            {cs} {fmt(data.combined_balance || 0)}
          </p>
        </div>
      )}

      {/* Partner P&L Breakdown */}
      <div className="card mb-5">
        <h2 className="font-bold mb-4">Partner Breakdown</h2>
        <div className="space-y-4">
          {data?.partners?.map(p => (
            <div key={p.id} className="border border-slate-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{p.name}</h3>
                <span className="badge bg-slate-100 text-slate-600">Partner</span>
              </div>
              <div className={`grid grid-cols-2 ${p.withdrawals > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3 text-sm`}>
                <div>
                  <p className="text-slate-500 text-xs">Income Collected</p>
                  <p className="font-medium text-emerald-600">{cs} {fmt(p.personal_income)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Expenses Paid</p>
                  <p className="font-medium text-red-600">{cs} {fmt(p.personal_expenses)}</p>
                </div>
                {p.withdrawals > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs">Withdrawn</p>
                    <p className="font-medium text-sky-600">{cs} {fmt(p.withdrawals)}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs">Profit Share</p>
                  <p className={`font-medium ${p.profit_share >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {cs} {fmt(Math.abs(p.profit_share))}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Settlement</p>
                  <p className={`font-bold ${p.settlement >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {p.settlement >= 0 ? `Receives ${cs} ${fmt(p.settlement)}` : `Owes ${cs} ${fmt(Math.abs(p.settlement))}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charity / Donation */}
      {(data?.profit || 0) > 0 && (
        <div className="card mb-5">
          <h2 className="font-bold mb-3">Charity Donations (10% of Profit Share)</h2>
          <p className="text-xs text-slate-500 mb-3">Each partner donates 10% of their profit share for charitable causes.</p>
          <div className="space-y-2">
            {data?.partners?.map(p => {
              const donation = Math.max(0, p.profit_share * 0.1);
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="font-medium">{p.name}</span>
                  <span className="font-bold text-purple-600">{cs} {fmt(Math.round(donation))}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 font-bold">
              <span>Total Charity</span>
              <span className="text-purple-600">{cs} {fmt(Math.round((data?.profit || 0) * 0.1))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Summary */}
      <div className="card mb-5">
        <h2 className="font-bold mb-3">Settlement Summary</h2>
        <p className="text-xs text-slate-500 mb-4">
          After accounting for each partner's income collected, expenses paid, and their profit share:
        </p>
        <div className="space-y-2 mb-4">
          {data?.partners?.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="font-medium">{p.name}</span>
              <span className={`font-bold ${p.settlement >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {p.settlement >= 0
                  ? `Should receive ${cs} ${fmt(p.settlement)}`
                  : `Should pay ${cs} ${fmt(Math.abs(p.settlement))}`
                }
              </span>
            </div>
          ))}
        </div>

        {/* Who Pays Whom */}
        {data?.transfers?.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Who Pays Whom</h3>
            <div className="space-y-3">
              {data.transfers.map((t, i) => (
                <TransferCard key={i} t={t} user={user} cs={cs} business={business} monthName={monthName} y={y} />
              ))}
            </div>
          </div>
        )}

        {data?.combined_income > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            Combined account holds {cs} {fmt(data.combined_income)} which can be used for settlements.
          </p>
        )}
      </div>

      {/* Income by Partner */}
      <div className="grid gap-4 sm:grid-cols-2 mb-5">
        <div className="card">
          <h2 className="font-bold mb-3">Income by Partner</h2>
          {data?.income_by_partner?.length === 0 && <p className="text-sm text-slate-400">No personal income</p>}
          {data?.income_by_partner?.map((item, i) => {
            const maxIncome = Math.max(...data.income_by_partner.map(x => x.total), 1);
            return (
              <div key={i} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.name}</span>
                  <span className="font-medium">{cs} {fmt(item.total)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(item.total / maxIncome) * 100}%` }}></div>
                </div>
              </div>
            );
          })}
          {data?.combined_income > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span>Combined Account</span>
                <span className="font-medium">{cs} {fmt(data.combined_income)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-sky-500 h-2 rounded-full transition-all" style={{ width: `${(data.combined_income / Math.max(data.total_income, 1)) * 100}%` }}></div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold mb-3">Expenses by Partner</h2>
          {data?.expenses_by_partner?.length === 0 && <p className="text-sm text-slate-400">No expenses</p>}
          {data?.expenses_by_partner?.map((item, i) => {
            const maxExp = Math.max(...data.expenses_by_partner.map(x => x.total), 1);
            return (
              <div key={i} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.name}</span>
                  <span className="font-medium">{cs} {fmt(item.total)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(item.total / maxExp) * 100}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expenses by Category */}
      <div className="card mb-5">
        <h2 className="font-bold mb-3">Expenses by Category</h2>
        {data?.expenses_by_category?.length === 0 && <p className="text-sm text-slate-400">No expenses</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {data?.expenses_by_category?.map((cat, i) => {
            const maxCat = Math.max(...data.expenses_by_category.map(x => x.total), 1);
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{cat.category}</span>
                    <span className="font-medium">{cs} {fmt(cat.total)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-slate-500 h-1.5 rounded-full transition-all" style={{ width: `${(cat.total / maxCat) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Chart */}
      {data?.daily_data?.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-3">Daily Overview</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-1 items-end min-w-max" style={{ height: '150px' }}>
              {data.daily_data.map((d, i) => {
                const maxVal = Math.max(...data.daily_data.map(x => Math.max(x.income, x.expenses)), 1);
                const incH = (d.income / maxVal) * 130;
                const expH = (d.expenses / maxVal) * 130;
                const day = d.date.split('-')[2];
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5" style={{ minWidth: '24px' }}>
                    <div className="flex gap-0.5 items-end" style={{ height: '130px' }}>
                      <div className="w-2.5 bg-emerald-400 rounded-t" style={{ height: `${Math.max(incH, 2)}px` }} title={`Income: ${cs} ${fmt(d.income)}`}></div>
                      <div className="w-2.5 bg-red-400 rounded-t" style={{ height: `${Math.max(expH, 2)}px` }} title={`Expense: ${cs} ${fmt(d.expenses)}`}></div>
                    </div>
                    <span className="text-[9px] text-slate-400">{day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 rounded"></div> Income</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded"></div> Expenses</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransferCard({ t, user, cs, business, monthName, y }) {
  const [showSettle, setShowSettle] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [settling, setSettling] = useState(false);

  const iAmPayer = t.from_id === user.id;
  const iAmReceiver = t.to_id === user.id;
  const canSettle = iAmPayer || iAmReceiver;

  const handleSettle = async () => {
    const paid = parseFloat(paidAmount) || 0;
    const ledger = parseFloat(ledgerAmount) || 0;
    if (paid === 0 && ledger === 0) return;

    const today = new Date().toISOString().split('T')[0];
    setSettling(true);
    try {
      // Record paid amount (credit = money given, debit = money received)
      if (paid > 0) {
        const desc = `${business?.name} paid - ${monthName} ${y}`;
        if (iAmPayer) {
          await api.addLedgerEntry({ partner_id: t.to_id, type: 'credit', amount: paid, description: desc, date: today });
        } else {
          await api.addLedgerEntry({ partner_id: t.from_id, type: 'debit', amount: paid, description: desc, date: today });
        }
      }
      // Record ledger adjustment (debit = I owe, credit = they owe me)
      if (ledger > 0) {
        const desc = `${business?.name} settlement - ${monthName} ${y}`;
        if (iAmPayer) {
          await api.addLedgerEntry({ partner_id: t.to_id, type: 'debit', amount: ledger, description: desc, date: today });
        } else {
          await api.addLedgerEntry({ partner_id: t.from_id, type: 'credit', amount: ledger, description: desc, date: today });
        }
      }
      alert(`Settlement recorded!${paid > 0 ? `\nPaid: ${cs} ${fmt(paid)}` : ''}${ledger > 0 ? `\nAdjusted to ledger: ${cs} ${fmt(ledger)}` : ''}`);
      setShowSettle(false);
      setPaidAmount('');
      setLedgerAmount('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-3 border border-slate-200">
      <div className="flex items-center gap-3">
        <span className="font-bold text-orange-600">{t.from_name}</span>
        <div className="flex-1 flex items-center">
          <div className="flex-1 h-0.5 bg-slate-200"></div>
          <svg className="w-4 h-4 text-slate-400 -mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </div>
        <span className="font-bold text-blue-600">{t.to_name}</span>
        <span className="font-bold text-lg ml-2">{cs} {fmt(t.amount)}</span>
      </div>

      {canSettle && !showSettle && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              setPaidAmount(t.amount.toString());
              setLedgerAmount('');
              setShowSettle(true);
            }}
            className="text-xs py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors"
          >
            Paid Full
          </button>
          <button
            onClick={() => {
              setPaidAmount('');
              setLedgerAmount(t.amount.toString());
              setShowSettle(true);
            }}
            className="text-xs py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            Adjust to Ledger
          </button>
          <button
            onClick={() => {
              setPaidAmount('');
              setLedgerAmount('');
              setShowSettle(true);
            }}
            className="text-xs py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors"
          >
            Split
          </button>
        </div>
      )}

      {canSettle && showSettle && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cash Paid ({cs})</label>
              <input type="number" className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md" placeholder="0" min="0" step="any" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Adjust to Ledger ({cs})</label>
              <input type="number" className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md" placeholder="0" min="0" step="any" value={ledgerAmount} onChange={e => setLedgerAmount(e.target.value)} />
            </div>
          </div>
          {(parseFloat(paidAmount) || 0) + (parseFloat(ledgerAmount) || 0) > 0 && (
            <p className="text-xs text-slate-400 mb-2">
              Total: {cs} {fmt((parseFloat(paidAmount) || 0) + (parseFloat(ledgerAmount) || 0))} of {cs} {fmt(t.amount)}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleSettle} disabled={settling} className="flex-1 text-xs py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-700 font-medium transition-colors">
              {settling ? 'Saving...' : 'Confirm Settlement'}
            </button>
            <button onClick={() => setShowSettle(false)} className="text-xs py-1.5 px-3 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
