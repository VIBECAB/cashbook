import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BusinessDetail from './pages/BusinessDetail';
import Employees from './pages/Employees';
import Analytics from './pages/Analytics';
import EmployeePanel from './pages/EmployeePanel';
import Ledger from './pages/Ledger';
import BankBalance from './pages/BankBalance';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;
  }

  // Employee gets a different layout
  if (user && user.role === 'employee') {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/*" element={<ProtectedRoute><EmployeePanel /></ProtectedRoute>} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="business/:id" element={<BusinessDetail />} />
        <Route path="business/:id/employees" element={<Employees />} />
        <Route path="business/:id/analytics" element={<Analytics />} />
        <Route path="business/:id/bank" element={<BankBalance />} />
        <Route path="ledger" element={<Ledger />} />
      </Route>
    </Routes>
  );
}
