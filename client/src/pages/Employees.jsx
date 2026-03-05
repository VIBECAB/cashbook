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
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(null);
  const [showAdvanceForm, setShowAdvanceForm] = useState(null);

  const [newEmp, setNewEmp] = useState({ name: '', username: '', password: '' });
  const [budgetForm, setBudgetForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [advanceForm, setAdvanceForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
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
    const [b, e, a] = await Promise.all([
      api.getEmployeeBudgets(emp.id),
      api.getEmployeeExpenses(emp.id),
      api.getEmployeeAdvances(emp.id)
    ]);
    setBudgets(b);
    setExpenses(e);
    setAdvances(a);
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

  const handleGiveAdvance = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.giveAdvance(showAdvanceForm.id, {
        ...advanceForm,
        amount: parseFloat(advanceForm.amount),
        business_id: businessId
      });
      setAdvanceForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setShowAdvanceForm(null);
      fetchEmployees();
      if (selected?.id === showAdvanceForm.id) selectEmployee(showAdvanceForm);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSettleAdvance = async (empId, advanceId) => {
    try {
      await api.settleAdvance(empId, advanceId);
      fetchEmployees();
      if (selected) selectEmployee(selected);
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg sm:text-xl font-bold">{business?.name} - Employees</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary text-xs sm:text-sm py-2 px-3">
          + Add
        </button>
      </div>

      {/* Add Employee Form */}
      {showAddForm && (
        <form onSubmit={handleAddEmployee} className="card mb-4 p-3 sm:p-5">
          <h3 className="font-semibold text-sm mb-3">New Employee</h3>
          {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="label text-xs">Name</label>
              <input className="input text-sm" required value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">Username</label>
              <input className="input text-sm" required value={newEmp.username} onChange={e => setNewEmp({ ...newEmp, username: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">Password</label>
              <input className="input text-sm" type="password" required value={newEmp.password} onChange={e => setNewEmp({ ...newEmp, password: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-xs py-2">Create</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-outline text-xs py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Employee List */}
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        {employees.length === 0 && <p className="text-slate-400 text-sm col-span-2 text-center py-8">No employees yet</p>}
        {employees.map(emp => (
          <div key={emp.id} className={`card p-3 sm:p-5 cursor-pointer transition-shadow hover:shadow-md ${selected?.id === emp.id ? 'ring-2 ring-slate-800' : ''} ${!emp.active ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-2" onClick={() => selectEmployee(emp)}>
              <div>
                <h3 className="font-semibold text-sm">{emp.name}</h3>
                <p className="text-[10px] sm:text-xs text-slate-400">@{emp.username}</p>
              </div>
              <span className={`badge text-[10px] ${emp.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {emp.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2" onClick={() => selectEmployee(emp)}>
              <div>
                <p className="text-slate-500 text-[10px]">Budget</p>
                <p className="font-semibold">Rs {fmt(emp.total_budget)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">Spent</p>
                <p className="font-semibold text-red-600">Rs {fmt(emp.total_spent)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">Advance</p>
                <p className={`font-semibold ${parseFloat(emp.unsettled_advances) > 0 ? 'text-orange-600' : ''}`}>Rs {fmt(emp.unsettled_advances)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">Remaining</p>
                <p className="font-semibold text-emerald-600">Rs {fmt(emp.total_budget - emp.total_spent)}</p>
              </div>
            </div>
            {parseFloat(emp.unsettled_advances) > 0 && (
              <div className="text-[10px] sm:text-xs text-orange-600 bg-orange-50 px-2 py-1.5 rounded mb-2">
                Rs {fmt(emp.unsettled_advances)} advance to deduct
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => { setShowBudgetForm(emp); setShowAdvanceForm(null); setError(''); }} className="btn-success text-[10px] sm:text-xs py-1.5 px-2 sm:px-3">
                Budget
              </button>
              <button onClick={() => { setShowAdvanceForm(emp); setShowBudgetForm(null); setError(''); }} className="btn-primary text-[10px] sm:text-xs py-1.5 px-2 sm:px-3">
                Advance
              </button>
              <button onClick={() => handleToggle(emp)} className="btn-outline text-[10px] sm:text-xs py-1.5 px-2 sm:px-3">
                {emp.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Give Budget Form */}
      {showBudgetForm && (
        <form onSubmit={handleGiveBudget} className="card mb-4 p-3 sm:p-5">
          <h3 className="font-semibold text-sm mb-2">Give Budget to {showBudgetForm.name}</h3>
          {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}
          <p className="text-[10px] sm:text-xs text-slate-500 mb-3">
            Logged as your expense and added to {showBudgetForm.name}'s budget.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="label text-xs">Amount (Rs)</label>
              <input type="number" className="input text-sm" required min="1" value={budgetForm.amount} onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">Description</label>
              <input className="input text-sm" value={budgetForm.description} onChange={e => setBudgetForm({ ...budgetForm, description: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">Date</label>
              <input type="date" className="input text-sm" required value={budgetForm.date} onChange={e => setBudgetForm({ ...budgetForm, date: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-success text-xs py-2">Give Budget</button>
            <button type="button" onClick={() => setShowBudgetForm(null)} className="btn-outline text-xs py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Give Advance Form */}
      {showAdvanceForm && (
        <form onSubmit={handleGiveAdvance} className="card mb-4 p-3 sm:p-5">
          <h3 className="font-semibold text-sm mb-2">Give Advance to {showAdvanceForm.name}</h3>
          {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}
          <p className="text-[10px] sm:text-xs text-slate-500 mb-3">
            Logged as your expense. Shown when giving next month's budget.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="label text-xs">Amount (Rs)</label>
              <input type="number" className="input text-sm" required min="1" value={advanceForm.amount} onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">Description</label>
              <input className="input text-sm" value={advanceForm.description} onChange={e => setAdvanceForm({ ...advanceForm, description: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">Date</label>
              <input type="date" className="input text-sm" required value={advanceForm.date} onChange={e => setAdvanceForm({ ...advanceForm, date: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-xs py-2">Give Advance</button>
            <button type="button" onClick={() => setShowAdvanceForm(null)} className="btn-outline text-xs py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Selected Employee Details */}
      {selected && (
        <div className="card p-3 sm:p-5">
          <h3 className="font-semibold text-sm mb-3">{selected.name} - Details</h3>

          <div className="mb-4">
            <h4 className="text-xs font-medium text-slate-600 mb-2">Budgets Received</h4>
            {budgets.length === 0 ? (
              <p className="text-[10px] sm:text-xs text-slate-400">No budgets yet</p>
            ) : (
              <div className="space-y-1">
                {budgets.map(b => (
                  <div key={b.id} className="flex justify-between text-xs py-1.5 border-b border-slate-50">
                    <span>Rs {fmt(b.amount)} from {b.partner_name} {b.description ? `- ${b.description}` : ''}</span>
                    <span className="text-slate-400 text-[10px] ml-2">{b.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <h4 className="text-xs font-medium text-orange-600 mb-2">Advances</h4>
            {advances.length === 0 ? (
              <p className="text-[10px] sm:text-xs text-slate-400">No advances</p>
            ) : (
              <div className="space-y-1">
                {advances.map(a => (
                  <div key={a.id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50">
                    <span>
                      Rs {fmt(a.amount)} from {a.partner_name} {a.description ? `- ${a.description}` : ''}
                      {a.settled ? <span className="ml-1 text-[10px] text-emerald-600 font-medium">(Settled)</span> : <span className="ml-1 text-[10px] text-orange-600 font-medium">(Pending)</span>}
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-slate-400 text-[10px]">{a.date}</span>
                      {!a.settled && (
                        <button onClick={() => handleSettleAdvance(selected.id, a.id)} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-100">
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-600 mb-2">Expenses</h4>
            {expenses.length === 0 ? (
              <p className="text-[10px] sm:text-xs text-slate-400">No expenses yet</p>
            ) : (
              <div className="space-y-1">
                {expenses.map(e => (
                  <div key={e.id} className="flex justify-between text-xs py-1.5 border-b border-slate-50">
                    <span>Rs {fmt(e.amount)} {e.description ? `- ${e.description}` : ''}</span>
                    <span className="text-slate-400 text-[10px] ml-2">{e.date}</span>
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
