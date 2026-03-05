import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePassword from './ChangePassword';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showPwModal, setShowPwModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded" />
            <span className="text-base sm:text-lg font-bold tracking-tight">Cashbook</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/ledger" className={`text-xs sm:text-sm px-2 py-1 rounded-md transition-colors ${location.pathname === '/ledger' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
              Ledger
            </Link>
            <button onClick={() => setShowPwModal(true)} className="text-xs sm:text-sm text-slate-300 hover:text-white transition-colors hidden sm:block">
              {user?.name}
            </button>
            <button onClick={logout} className="text-[10px] sm:text-xs bg-slate-700 hover:bg-slate-600 px-2 sm:px-3 py-1.5 rounded-md transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      {showPwModal && <ChangePassword onClose={() => setShowPwModal(false)} />}

      {/* Business tabs if on a business page */}
      {location.pathname.startsWith('/business/') && <BusinessNav />}

      {/* Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <Outlet />
      </main>
    </div>
  );
}

function BusinessNav() {
  const location = useLocation();
  const { user } = useAuth();
  const match = location.pathname.match(/^\/business\/(\d+)/);
  if (!match) return null;
  const bizId = match[1];

  const tabs = [
    { path: `/business/${bizId}`, label: 'Transactions', shortLabel: 'Txns' },
    { path: `/business/${bizId}/employees`, label: 'Employees', shortLabel: 'Emps' },
    { path: `/business/${bizId}/analytics`, label: 'Analytics', shortLabel: 'Stats' },
    { path: `/business/${bizId}/bank`, label: 'Bank Balance', shortLabel: 'Bank' },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-12 sm:top-14 z-40">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 flex gap-0.5 sm:gap-1 overflow-x-auto">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-2.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
        <Link to="/" className="ml-auto px-2.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm text-slate-400 hover:text-slate-600">
          Back
        </Link>
      </div>
    </div>
  );
}
