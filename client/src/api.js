const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  changePassword: (current_password, new_password) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),

  // Businesses
  getBusinesses: () => request('/businesses'),
  getBusiness: (id) => request(`/businesses/${id}`),

  // Transactions
  getTransactions: (params) => request(`/transactions?${new URLSearchParams(params)}`),
  addTransaction: (data) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  // Employees
  getEmployees: (businessId) => request(`/employees?business_id=${businessId}`),
  addEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  giveBudget: (empId, data) => request(`/employees/${empId}/budget`, { method: 'POST', body: JSON.stringify(data) }),
  getEmployeeBudgets: (empId) => request(`/employees/${empId}/budgets`),
  getEmployeeExpenses: (empId) => request(`/employees/${empId}/expenses`),
  addEmployeeExpense: (empId, data) => request(`/employees/${empId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
  toggleEmployee: (empId) => request(`/employees/${empId}/toggle`, { method: 'PATCH' }),
  giveAdvance: (empId, data) => request(`/employees/${empId}/advance`, { method: 'POST', body: JSON.stringify(data) }),
  getEmployeeAdvances: (empId) => request(`/employees/${empId}/advances`),
  settleAdvance: (empId, advanceId) => request(`/employees/${empId}/advance/${advanceId}/settle`, { method: 'POST' }),

  // Analytics
  getAnalytics: (params) => request(`/analytics?${new URLSearchParams(params)}`),
  getDashboard: (params) => request(`/analytics/dashboard${params ? `?${new URLSearchParams(params)}` : ''}`),

  // Partner Ledger
  getLedger: (partnerId) => request(`/ledger${partnerId ? `?partner_id=${partnerId}` : ''}`),
  getLedgerSummary: () => request('/ledger/summary'),
  addLedgerEntry: (data) => request('/ledger', { method: 'POST', body: JSON.stringify(data) }),
  updateLedgerEntry: (id, data) => request(`/ledger/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLedgerEntry: (id) => request(`/ledger/${id}`, { method: 'DELETE' }),
};
