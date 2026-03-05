import { useState, useEffect } from 'react';
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">{business?.name} - Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-500">{monthName} {y}</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-auto text-xs" />
      </div>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5">Total Income</p>
          <p className="text-sm sm:text-lg font-bold text-emerald-600">{cs} {fmt(data?.total_income || 0)}</p>
          {data?.combined_income > 0 && (
            <p className="text-[9px] sm:text-xs text-slate-400 mt-0.5">Combined: {cs} {fmt(data.combined_income)}</p>
          )}
        </div>
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5">Total Expenses</p>
          <p className="text-sm sm:text-lg font-bold text-red-600">{cs} {fmt(data?.total_expenses || 0)}</p>
        </div>
        <div className="card text-center py-2.5 px-1">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5">{(data?.profit || 0) >= 0 ? 'Profit' : 'Loss'}</p>
          <p className={`text-sm sm:text-lg font-bold ${(data?.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {cs} {fmt(Math.abs(data?.profit || 0))}
          </p>
        </div>
      </div>

      {/* Combined Account Balance */}
      {data?.combined_income > 0 && (
        <div className="card mb-5 flex items-center justify-between py-3">
          <div>
            <p className="font-semibold text-sm">Combined Account</p>
            <p className="text-[10px] sm:text-xs text-slate-400">In: {cs} {fmt(data.combined_income)} | Out: {cs} {fmt(data.total_withdrawals || 0)}</p>
          </div>
          <p className={`text-base sm:text-lg font-bold ${(data.combined_balance || 0) >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
            {cs} {fmt(data.combined_balance || 0)}
          </p>
        </div>
      )}

      {/* Partner P&L Breakdown */}
      <div className="card mb-4 p-3 sm:p-5">
        <h2 className="font-bold text-sm sm:text-base mb-3">Partner Breakdown</h2>
        <div className="space-y-3">
          {data?.partners?.map(p => (
            <div key={p.id} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{p.name}</h3>
                <span className="badge bg-slate-100 text-slate-600 text-[10px]">Partner</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-slate-500 text-[10px]">Income</p>
                  <p className="font-medium text-emerald-600">{cs} {fmt(p.personal_income)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px]">Expenses</p>
                  <p className="font-medium text-red-600">{cs} {fmt(p.personal_expenses)}</p>
                </div>
                {p.withdrawals > 0 && (
                  <div>
                    <p className="text-slate-500 text-[10px]">Withdrawn</p>
                    <p className="font-medium text-sky-600">{cs} {fmt(p.withdrawals)}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-[10px]">Share</p>
                  <p className={`font-medium ${p.profit_share >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {cs} {fmt(Math.abs(p.profit_share))}
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-50">
                <p className={`text-xs font-bold ${p.settlement >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {p.settlement >= 0 ? `Receives ${cs} ${fmt(p.settlement)}` : `Owes ${cs} ${fmt(Math.abs(p.settlement))}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charity / Donation */}
      {(data?.profit || 0) > 0 && (
        <div className="card mb-4 p-3 sm:p-5">
          <h2 className="font-bold text-sm sm:text-base mb-2">Charity (10% of Share)</h2>
          <div className="space-y-1.5">
            {data?.partners?.map(p => {
              const donation = Math.max(0, p.profit_share * 0.1);
              return (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-xs sm:text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="font-bold text-purple-600">{cs} {fmt(Math.round(donation))}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-1.5 font-bold text-xs sm:text-sm">
              <span>Total Charity</span>
              <span className="text-purple-600">{cs} {fmt(Math.round((data?.profit || 0) * 0.1))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Summary */}
      <div className="card mb-4 p-3 sm:p-5">
        <h2 className="font-bold text-sm sm:text-base mb-2">Settlement Summary</h2>
        <p className="text-[10px] sm:text-xs text-slate-500 mb-3">
          After income collected, expenses paid, and profit share:
        </p>
        <div className="space-y-1.5 mb-3">
          {data?.partners?.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-xs sm:text-sm">
              <span className="font-medium">{p.name}</span>
              <span className={`font-bold ${p.settlement >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {p.settlement >= 0
                  ? `Receives ${cs} ${fmt(p.settlement)}`
                  : `Pays ${cs} ${fmt(Math.abs(p.settlement))}`
                }
              </span>
            </div>
          ))}
        </div>

        {/* Who Pays Whom */}
        {data?.transfers?.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-3">
            <h3 className="font-semibold text-xs sm:text-sm mb-2">Who Pays Whom</h3>
            <div className="space-y-2">
              {data.transfers.map((t, i) => (
                <TransferCard key={i} t={t} user={user} cs={cs} business={business} monthName={monthName} y={y} />
              ))}
            </div>
          </div>
        )}

        {data?.combined_income > 0 && (
          <p className="text-[10px] sm:text-xs text-slate-400 mt-3">
            Combined account holds {cs} {fmt(data.combined_income)} for settlements.
          </p>
        )}
      </div>

      {/* Income & Expenses by Partner */}
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="card p-3 sm:p-5">
          <h2 className="font-bold text-sm mb-2">Income by Partner</h2>
          {data?.income_by_partner?.length === 0 && <p className="text-xs text-slate-400">No personal income</p>}
          {data?.income_by_partner?.map((item, i) => {
            const maxIncome = Math.max(...data.income_by_partner.map(x => x.total), 1);
            return (
              <div key={i} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span>{item.name}</span>
                  <span className="font-medium">{cs} {fmt(item.total)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${(item.total / maxIncome) * 100}%` }}></div>
                </div>
              </div>
            );
          })}
          {data?.combined_income > 0 && (
            <div className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span>Combined Account</span>
                <span className="font-medium">{cs} {fmt(data.combined_income)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div className="bg-sky-500 h-1.5 rounded-full transition-all" style={{ width: `${(data.combined_income / Math.max(data.total_income, 1)) * 100}%` }}></div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-3 sm:p-5">
          <h2 className="font-bold text-sm mb-2">Expenses by Partner</h2>
          {data?.expenses_by_partner?.length === 0 && <p className="text-xs text-slate-400">No expenses</p>}
          {data?.expenses_by_partner?.map((item, i) => {
            const maxExp = Math.max(...data.expenses_by_partner.map(x => x.total), 1);
            return (
              <div key={i} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span>{item.name}</span>
                  <span className="font-medium">{cs} {fmt(item.total)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{ width: `${(item.total / maxExp) * 100}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expenses by Category */}
      <div className="card mb-4 p-3 sm:p-5">
        <h2 className="font-bold text-sm mb-2">Expenses by Category</h2>
        {data?.expenses_by_category?.length === 0 && <p className="text-xs text-slate-400">No expenses</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {data?.expenses_by_category?.map((cat, i) => {
            const maxCat = Math.max(...data.expenses_by_category.map(x => x.total), 1);
            return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{cat.category}</span>
                  <span className="font-medium">{cs} {fmt(cat.total)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-slate-500 h-1.5 rounded-full transition-all" style={{ width: `${(cat.total / maxCat) * 100}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Chart */}
      {data?.daily_data?.length > 0 && (
        <div className="card p-3 sm:p-5">
          <h2 className="font-bold text-sm mb-2">Daily Overview</h2>
          <div className="overflow-x-auto -mx-3 px-3">
            <div className="flex gap-0.5 sm:gap-1 items-end min-w-max" style={{ height: '130px' }}>
              {data.daily_data.map((d, i) => {
                const maxVal = Math.max(...data.daily_data.map(x => Math.max(x.income, x.expenses)), 1);
                const incH = (d.income / maxVal) * 110;
                const expH = (d.expenses / maxVal) * 110;
                const day = d.date.split('-')[2];
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5" style={{ minWidth: '20px' }}>
                    <div className="flex gap-px items-end" style={{ height: '110px' }}>
                      <div className="w-2 bg-emerald-400 rounded-t" style={{ height: `${Math.max(incH, 2)}px` }} title={`Income: ${cs} ${fmt(d.income)}`}></div>
                      <div className="w-2 bg-red-400 rounded-t" style={{ height: `${Math.max(expH, 2)}px` }} title={`Expense: ${cs} ${fmt(d.expenses)}`}></div>
                    </div>
                    <span className="text-[8px] sm:text-[9px] text-slate-400">{day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-2 text-[10px] sm:text-xs text-slate-500">
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-emerald-400 rounded"></div> Income</div>
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-400 rounded"></div> Expenses</div>
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
      if (paid > 0) {
        const desc = `${business?.name} paid - ${monthName} ${y}`;
        if (iAmPayer) {
          await api.addLedgerEntry({ partner_id: t.to_id, type: 'credit', amount: paid, description: desc, date: today });
        } else {
          await api.addLedgerEntry({ partner_id: t.from_id, type: 'debit', amount: paid, description: desc, date: today });
        }
      }
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
    <div className="bg-white rounded-lg p-2.5 sm:p-3 border border-slate-200">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-orange-600 text-xs sm:text-sm">{t.from_name}</span>
        <div className="flex-1 flex items-center min-w-[30px]">
          <div className="flex-1 h-0.5 bg-slate-200"></div>
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 -mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </div>
        <span className="font-bold text-blue-600 text-xs sm:text-sm">{t.to_name}</span>
        <span className="font-bold text-sm sm:text-lg ml-1">{cs} {fmt(t.amount)}</span>
      </div>

      {canSettle && !showSettle && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button
            onClick={() => { setPaidAmount(t.amount.toString()); setLedgerAmount(''); setShowSettle(true); }}
            className="text-[10px] sm:text-xs py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors"
          >
            Paid Full
          </button>
          <button
            onClick={() => { setPaidAmount(''); setLedgerAmount(t.amount.toString()); setShowSettle(true); }}
            className="text-[10px] sm:text-xs py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            To Ledger
          </button>
          <button
            onClick={() => { setPaidAmount(''); setLedgerAmount(''); setShowSettle(true); }}
            className="text-[10px] sm:text-xs py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors"
          >
            Split
          </button>
        </div>
      )}

      {canSettle && showSettle && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">Cash Paid ({cs})</label>
              <input type="number" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md" placeholder="0" min="0" step="any" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">To Ledger ({cs})</label>
              <input type="number" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md" placeholder="0" min="0" step="any" value={ledgerAmount} onChange={e => setLedgerAmount(e.target.value)} />
            </div>
          </div>
          {(parseFloat(paidAmount) || 0) + (parseFloat(ledgerAmount) || 0) > 0 && (
            <p className="text-[10px] text-slate-400 mb-2">
              Total: {cs} {fmt((parseFloat(paidAmount) || 0) + (parseFloat(ledgerAmount) || 0))} of {cs} {fmt(t.amount)}
            </p>
          )}
          <div className="flex gap-1.5">
            <button onClick={handleSettle} disabled={settling} className="flex-1 text-xs py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-700 font-medium transition-colors">
              {settling ? 'Saving...' : 'Confirm'}
            </button>
            <button onClick={() => setShowSettle(false)} className="text-xs py-1.5 px-2 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
