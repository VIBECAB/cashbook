import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  const now = new Date();
  const monthName = MONTHS[now.getMonth()];

  // Aggregate totals by currency
  const totals = {};
  data?.businesses?.forEach(biz => {
    const cur = biz.default_currency || 'PKR';
    if (!totals[cur]) totals[cur] = { income: 0, expenses: 0, profit: 0, myShare: 0 };
    totals[cur].income += parseFloat(biz.total_income) || 0;
    totals[cur].expenses += parseFloat(biz.total_expenses) || 0;
    totals[cur].profit += parseFloat(biz.profit) || 0;
    totals[cur].myShare += parseFloat(biz.my_share) || 0;
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg sm:text-xl font-bold">Welcome, {user.name}</h1>
        <p className="text-slate-500 text-xs sm:text-sm">{monthName} {now.getFullYear()} Overview</p>
      </div>

      {/* Overall Analytics Summary */}
      {Object.entries(totals).map(([cur, t]) => {
        const cs = cur === 'GBP' ? '\u00a3' : 'Rs';
        return (
          <div key={cur} className="mb-5">
            {Object.keys(totals).length > 1 && (
              <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{cur} Summary</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="card py-3 px-3 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500">Total Income</p>
                <p className="font-bold text-emerald-600 text-sm sm:text-base">{cs} {fmt(t.income)}</p>
              </div>
              <div className="card py-3 px-3 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500">Total Expenses</p>
                <p className="font-bold text-red-600 text-sm sm:text-base">{cs} {fmt(t.expenses)}</p>
              </div>
              <div className="card py-3 px-3 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500">{t.profit >= 0 ? 'Total Profit' : 'Total Loss'}</p>
                <p className={`font-bold text-sm sm:text-base ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {cs} {fmt(Math.abs(t.profit))}
                </p>
              </div>
              <div className="card py-3 px-3 text-center">
                <p className="text-[10px] sm:text-xs text-slate-500">Your Total Share</p>
                <p className={`font-bold text-sm sm:text-base ${t.myShare >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {cs} {fmt(Math.abs(t.myShare))}
                </p>
              </div>
            </div>
            {t.profit > 0 && (
              <div className="mt-2 text-center">
                <span className="text-[10px] sm:text-xs text-slate-400">
                  Your Charity (10%): <span className="font-semibold text-purple-600">{cs} {fmt(Math.round(t.myShare * 0.1))}</span>
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Business Cards */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 mb-6">
        {data?.businesses?.map(biz => {
          const cs = biz.default_currency === 'GBP' ? '\u00a3' : 'Rs';
          const balanceLabel = biz.has_combined_account ? 'Kiddie Tube Balance' : biz.default_currency === 'GBP' ? 'GBP Balance' : 'Balance';
          return (
          <Link key={biz.id} to={`/business/${biz.id}`} className="card hover:shadow-md transition-shadow p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base sm:text-lg">{biz.name}</h2>
              <span className="badge bg-slate-100 text-slate-600 text-[10px]">Partner</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              <div>
                <p className="text-slate-500 text-[10px] sm:text-xs">Total Income</p>
                <p className="font-semibold text-emerald-600">{cs} {fmt(biz.total_income)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] sm:text-xs">Total Expenses</p>
                <p className="font-semibold text-red-600">{cs} {fmt(biz.total_expenses)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] sm:text-xs">{biz.profit >= 0 ? 'Profit' : 'Loss'}</p>
                <p className={`font-semibold ${biz.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {cs} {fmt(Math.abs(biz.profit))}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] sm:text-xs">Your Share</p>
                <p className={`font-semibold ${biz.my_share >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {cs} {fmt(Math.abs(biz.my_share))}
                </p>
              </div>
            </div>

            {/* Account Balance */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-slate-500">{balanceLabel}</span>
              <span className={`font-bold text-xs sm:text-sm ${(biz.account_balance || 0) >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
                {cs} {fmt(biz.account_balance || 0)}
              </span>
            </div>

            {/* Charity */}
            {biz.profit > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500">
                <span>Your Charity (10%): </span>
                <span className="font-semibold text-purple-600">{cs} {fmt(Math.round(biz.my_share * 0.1))}</span>
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px] sm:text-xs text-slate-500">
              <div>Your Income: <span className="font-medium text-slate-700">{cs} {fmt(biz.my_income)}</span></div>
              <div>Your Expenses: <span className="font-medium text-slate-700">{cs} {fmt(biz.my_expenses)}</span></div>
            </div>

            {/* Transfers */}
            {biz.transfers?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-500 mb-1">Settlements</p>
                {biz.transfers.map((t, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] sm:text-xs py-0.5">
                    <span className="font-semibold text-orange-600">{t.from_name}</span>
                    <span className="text-slate-400">pays</span>
                    <span className="font-semibold text-blue-600">{t.to_name}</span>
                    <span className="ml-auto font-bold text-slate-700">{cs} {fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Link>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <div className="card p-4 sm:p-5">
        <h2 className="font-bold text-sm sm:text-base mb-3">Recent Transactions</h2>
        {data?.recent_transactions?.length === 0 && (
          <p className="text-slate-400 text-sm py-4 text-center">No transactions yet</p>
        )}
        <div className="space-y-1.5">
          {data?.recent_transactions?.map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tx.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  <span className="text-xs sm:text-sm font-medium truncate">{tx.description || tx.type}</span>
                </div>
                <div className="text-[10px] sm:text-xs text-slate-400 ml-3">
                  {tx.business_name} &middot; {tx.source === 'combined' ? 'Combined' : tx.user_name} &middot; {tx.date}
                </div>
              </div>
              <span className={`text-xs sm:text-sm font-semibold ml-2 whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                {tx.type === 'income' ? '+' : '-'}{tx.currency === 'GBP' ? '\u00a3' : 'Rs'} {fmt(parseFloat(tx.amount))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
