import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function Employees() {
  const { id: businessId } = useParams();
  const [business, setBusiness] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(null);

  const [newEmp, setNewEmp] = useState({ name: '', username: '', password: '' });
  const [budgetForm, setBudgetForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [error, setError] = useState('');

  const fetchEmployees = () => {
    Promise.all([
      api.getBusiness(businessId),
      api.getEmployees(businessId)
    ]).then(([biz, emps]) => {
      setBusiness(biz);
      setEmployees(emps);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchEmployees(); }, [businessId]);

  const selectEmployee = async (emp) => {
    setSelected(emp);
    const [b, e] = await Promise.all([
      api.getEmployeeBudgets(emp.id),
      api.getEmployeeExpenses(emp.id)
    ]);
    setBudgets(b);
    setExpenses(e);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.addEmployee({ ...newEmp, business_id: businessId });
      setNewEmp({ name: '', username: '', password: '' });
      setShowAddForm(false);
      fetchEmployees();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGiveBudget = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.giveBudget(showBudgetForm.id, {
        ...budgetForm,
        amount: parseFloat(budgetForm.amount),
        business_id: businessId
      });
      setBudgetForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setShowBudgetForm(null);
      fetchEmployees();
      if (selected?.id === showBudgetForm.id) selectEmployee(showBudgetForm);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = async (emp) => {
    await api.toggleEmployee(emp.id);
    fetchEmployees();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">{business?.name} - Employees</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary text-sm">
          + Add Employee
        </button>
      </div>

      {/* Add Employee Form */}
      {showAddForm && (
        <form onSubmit={handleAddEmployee} className="card mb-5">
          <h3 className="font-semibold mb-3">New Employee</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="label">Name</label>
              <input className="input" required value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" required value={newEmp.username} onChange={e => setNewEmp({ ...newEmp, username: e.target.value })} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={newEmp.password} onChange={e => setNewEmp({ ...newEmp, password: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* Employee List */}
      <div className="grid gap-3 sm:grid-cols-2 mb-5">
        {employees.length === 0 && <p className="text-slate-400 text-sm col-span-2 text-center py-8">No employees yet</p>}
        {employees.map(emp => (
          <div key={emp.id} className={`card cursor-pointer transition-shadow hover:shadow-md ${selected?.id === emp.id ? 'ring-2 ring-slate-800' : ''} ${!emp.active ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-3" onClick={() => selectEmployee(emp)}>
              <div>
                <h3 className="font-semibold">{emp.name}</h3>
                <p className="text-xs text-slate-400">@{emp.username} &middot; Added by {emp.created_by_name}</p>
              </div>
              <span className={`badge ${emp.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {emp.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-3" onClick={() => selectEmployee(emp)}>
              <div>
                <p className="text-slate-500">Budget</p>
                <p className="font-semibold">Rs {fmt(emp.total_budget)}</p>
              </div>
              <div>
                <p className="text-slate-500">Spent</p>
                <p className="font-semibold text-red-600">Rs {fmt(emp.total_spent)}</p>
              </div>
              <div>
                <p className="text-slate-500">Remaining</p>
                <p className="font-semibold text-emerald-600">Rs {fmt(emp.total_budget - emp.total_spent)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowBudgetForm(emp); setError(''); }} className="btn-success text-xs py-1.5 px-3">
                Give Budget
              </button>
              <button onClick={() => handleToggle(emp)} className="btn-outline text-xs py-1.5 px-3">
                {emp.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Give Budget Form */}
      {showBudgetForm && (
        <form onSubmit={handleGiveBudget} className="card mb-5">
          <h3 className="font-semibold mb-3">Give Budget to {showBudgetForm.name}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}
          <p className="text-xs text-slate-500 mb-3">
            This will be logged as your expense and added to {showBudgetForm.name}'s budget.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="label">Amount (Rs)</label>
              <input type="number" className="input" required min="1" value={budgetForm.amount} onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={budgetForm.description} onChange={e => setBudgetForm({ ...budgetForm, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" required value={budgetForm.date} onChange={e => setBudgetForm({ ...budgetForm, date: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-success">Give Budget</button>
            <button type="button" onClick={() => setShowBudgetForm(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* Selected Employee Details */}
      {selected && (
        <div className="card">
          <h3 className="font-semibold mb-4">{selected.name} - Details</h3>

          <div className="mb-5">
            <h4 className="text-sm font-medium text-slate-600 mb-2">Budgets Received</h4>
            {budgets.length === 0 ? (
              <p className="text-xs text-slate-400">No budgets yet</p>
            ) : (
              <div className="space-y-1">
                {budgets.map(b => (
                  <div key={b.id} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
                    <span>Rs {fmt(b.amount)} from {b.partner_name} {b.description ? `- ${b.description}` : ''}</span>
                    <span className="text-slate-400 text-xs">{b.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-600 mb-2">Expenses</h4>
            {expenses.length === 0 ? (
              <p className="text-xs text-slate-400">No expenses yet</p>
            ) : (
              <div className="space-y-1">
                {expenses.map(e => (
                  <div key={e.id} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
                    <span>Rs {fmt(e.amount)} {e.description ? `- ${e.description}` : ''}</span>
                    <span className="text-slate-400 text-xs">{e.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
