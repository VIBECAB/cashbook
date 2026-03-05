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
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight">Cashbook</Link>
          <div className="flex items-center gap-3">
            <Link to="/ledger" className={`text-sm px-2.5 py-1 rounded-md transition-colors ${location.pathname === '/ledger' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white'}`}>
              Ledger
            </Link>
            <button onClick={() => setShowPwModal(true)} className="text-sm text-slate-300 hover:text-white transition-colors">
              {user?.name}
            </button>
            <button onClick={logout} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      {showPwModal && <ChangePassword onClose={() => setShowPwModal(false)} />}

      {/* Business tabs if on a business page */}
      {location.pathname.startsWith('/business/') && <BusinessNav />}

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-5">
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

  const biz = user?.businesses?.find(b => b.id === parseInt(bizId));

  const tabs = [
    { path: `/business/${bizId}`, label: 'Transactions' },
    { path: `/business/${bizId}/employees`, label: 'Employees' },
    { path: `/business/${bizId}/analytics`, label: 'Analytics' },
    { path: `/business/${bizId}/bank`, label: 'Bank Balance' },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-14 z-40">
      <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <Link to="/" className="ml-auto px-4 py-3 text-sm text-slate-400 hover:text-slate-600">
          Back
        </Link>
      </div>
    </div>
  );
}
