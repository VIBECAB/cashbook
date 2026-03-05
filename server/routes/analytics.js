const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Given partner settlements, calculate who should pay whom
// Partners with negative settlement owe money, positive ones should receive
function calculateTransfers(partners) {
  const debtors = []; // owe money (settlement < 0)
  const creditors = []; // should receive (settlement > 0)

  for (const p of partners) {
    if (p.settlement < -0.5) {
      debtors.push({ id: p.id, name: p.name, amount: Math.abs(p.settlement) });
    } else if (p.settlement > 0.5) {
      creditors.push({ id: p.id, name: p.name, amount: p.settlement });
    }
  }

  // Sort: largest debts first, largest credits first
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let di = 0, ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(debtors[di].amount, creditors[ci].amount);
    if (amount > 0.5) {
      transfers.push({
        from_id: debtors[di].id,
        from_name: debtors[di].name,
        to_id: creditors[ci].id,
        to_name: creditors[ci].name,
        amount: Math.round(amount)
      });
    }
    debtors[di].amount -= amount;
    creditors[ci].amount -= amount;
    if (debtors[di].amount < 0.5) di++;
    if (creditors[ci].amount < 0.5) ci++;
  }

  return transfers;
}

// Get monthly analytics for a business
router.get('/', (req, res) => {
  const { business_id, month, year, currency } = req.query;
  if (!business_id || !month || !year) {
    return res.status(400).json({ error: 'business_id, month, year required' });
  }

  // Verify access
  if (req.user.role === 'partner') {
    const access = db.prepare('SELECT 1 FROM business_partners WHERE business_id = ? AND user_id = ?')
      .get(business_id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access' });
  }

  const monthStr = month.toString().padStart(2, '0');
  const cur = currency || 'PKR';
  const curFilter = ` AND currency = '${cur === 'GBP' ? 'GBP' : 'PKR'}'`;

  // Get partners and shares
  const partners = db.prepare(`
    SELECT u.id, u.name, bp.share_percentage
    FROM business_partners bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.business_id = ?
  `).all(business_id);

  // Get total income
  const totalIncome = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE business_id = ? AND type = 'income'
    AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
  `).get(business_id, monthStr, year).total;

  // Get combined income
  const combinedIncome = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE business_id = ? AND type = 'income' AND source = 'combined'
    AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
  `).get(business_id, monthStr, year).total;

  // Get total expenses
  const totalExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE business_id = ? AND type = 'expense'
    AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
  `).get(business_id, monthStr, year).total;

  // Get total withdrawals from combined account
  const totalWithdrawals = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE business_id = ? AND type = 'withdrawal'
    AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
  `).get(business_id, monthStr, year).total;

  const profit = totalIncome - totalExpenses;
  const combinedBalance = combinedIncome - totalWithdrawals;

  // Per-partner breakdown
  const partnerBreakdown = partners.map(p => {
    const personalIncome = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE business_id = ? AND user_id = ? AND type = 'income' AND source = 'personal'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(business_id, p.id, monthStr, year).total;

    const personalExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE business_id = ? AND user_id = ? AND type = 'expense'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(business_id, p.id, monthStr, year).total;

    // Withdrawals from combined account by this partner
    const withdrawals = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE business_id = ? AND user_id = ? AND type = 'withdrawal'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(business_id, p.id, monthStr, year).total;

    const profitShare = profit * (p.share_percentage / 100);

    // Settlement calculation:
    // Partner is holding: personalIncome + withdrawals (money they took from business)
    // Partner spent for business: personalExpenses
    // Net position = (personalIncome + withdrawals) - personalExpenses
    // Settlement = profitShare - netPosition
    const netPosition = (personalIncome + withdrawals) - personalExpenses;
    const settlement = profitShare - netPosition;

    return {
      id: p.id,
      name: p.name,
      share_percentage: p.share_percentage,
      personal_income: personalIncome,
      personal_expenses: personalExpenses,
      withdrawals,
      profit_share: profitShare,
      net_position: netPosition,
      settlement
    };
  });

  // Income by source
  const incomeByPartner = db.prepare(`
    SELECT u.name, COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.business_id = ? AND t.type = 'income' AND t.source = 'personal'
    AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?${curFilter.replace(/currency/g, 't.currency')}
    GROUP BY t.user_id
  `).all(business_id, monthStr, year);

  // Expenses by partner
  const expensesByPartner = db.prepare(`
    SELECT u.name, COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.business_id = ? AND t.type = 'expense'
    AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?${curFilter.replace(/currency/g, 't.currency')}
    GROUP BY t.user_id
  `).all(business_id, monthStr, year);

  // Expense categories
  const expensesByCategory = db.prepare(`
    SELECT CASE WHEN category = '' THEN 'Uncategorized' ELSE category END as category,
           COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE business_id = ? AND type = 'expense'
    AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    GROUP BY category
    ORDER BY total DESC
  `).all(business_id, monthStr, year);

  // Daily totals for chart
  const dailyData = db.prepare(`
    SELECT date,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
    FROM transactions
    WHERE business_id = ?
    AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    GROUP BY date
    ORDER BY date
  `).all(business_id, monthStr, year);

  // Calculate transfers: who should pay whom
  const transfers = calculateTransfers(partnerBreakdown);

  // Withdrawals by partner
  const withdrawalsByPartner = db.prepare(`
    SELECT u.name, COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.business_id = ? AND t.type = 'withdrawal'
    AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?${curFilter.replace(/currency/g, 't.currency')}
    GROUP BY t.user_id
  `).all(business_id, monthStr, year);

  res.json({
    currency: cur,
    total_income: totalIncome,
    combined_income: combinedIncome,
    total_expenses: totalExpenses,
    total_withdrawals: totalWithdrawals,
    combined_balance: combinedBalance,
    profit,
    partners: partnerBreakdown,
    transfers,
    income_by_partner: incomeByPartner,
    expenses_by_partner: expensesByPartner,
    expenses_by_category: expensesByCategory,
    withdrawals_by_partner: withdrawalsByPartner,
    daily_data: dailyData
  });
});

// Dashboard summary - all businesses for a partner
router.get('/dashboard', (req, res) => {
  if (req.user.role !== 'partner') {
    return res.status(403).json({ error: 'Partners only' });
  }

  const now = new Date();
  const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
  const yearStr = now.getFullYear().toString();

  const businesses = db.prepare(`
    SELECT b.*, bp.share_percentage
    FROM businesses b
    JOIN business_partners bp ON b.id = bp.business_id
    WHERE bp.user_id = ?
  `).all(req.user.id);

  function getBusinessSummary(biz, cur) {
    const curFilter = ` AND currency = '${cur}'`;

    const totalIncome = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = ? AND type = 'income'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(biz.id, monthStr, yearStr).total;

    const totalExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = ? AND type = 'expense'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(biz.id, monthStr, yearStr).total;

    const myIncome = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = ? AND user_id = ? AND type = 'income' AND source = 'personal'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(biz.id, req.user.id, monthStr, yearStr).total;

    const myExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = ? AND user_id = ? AND type = 'expense'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(biz.id, req.user.id, monthStr, yearStr).total;

    const myWithdrawals = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = ? AND user_id = ? AND type = 'withdrawal'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(biz.id, req.user.id, monthStr, yearStr).total;

    // Combined account balance (for PKR combined view)
    const combinedIncome = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = ? AND type = 'income' AND source = 'combined'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(biz.id, monthStr, yearStr).total;

    const totalWithdrawals = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = ? AND type = 'withdrawal'
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
    `).get(biz.id, monthStr, yearStr).total;

    const profit = totalIncome - totalExpenses;
    const myShare = profit * (biz.share_percentage / 100);

    // Balance: for combined accounts it's combined income - withdrawals, otherwise income - expenses
    const account_balance = biz.has_combined_account && cur === 'PKR'
      ? combinedIncome - totalWithdrawals
      : totalIncome - totalExpenses;

    const allPartners = db.prepare(`
      SELECT u.id, u.name, bp.share_percentage
      FROM business_partners bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.business_id = ?
    `).all(biz.id);

    const partnerBreakdown = allPartners.map(p => {
      const pIncome = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = ? AND user_id = ? AND type = 'income' AND source = 'personal'
        AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
      `).get(biz.id, p.id, monthStr, yearStr).total;

      const pExpenses = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = ? AND user_id = ? AND type = 'expense'
        AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
      `).get(biz.id, p.id, monthStr, yearStr).total;

      const pWithdrawals = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = ? AND user_id = ? AND type = 'withdrawal'
        AND strftime('%m', date) = ? AND strftime('%Y', date) = ?${curFilter}
      `).get(biz.id, p.id, monthStr, yearStr).total;

      const profitShare = profit * (p.share_percentage / 100);
      const netPosition = (pIncome + pWithdrawals) - pExpenses;
      const settlement = profitShare - netPosition;

      return { id: p.id, name: p.name, share_percentage: p.share_percentage, settlement };
    });

    const transfers = calculateTransfers(partnerBreakdown);

    return {
      total_income: totalIncome,
      total_expenses: totalExpenses,
      profit,
      my_income: myIncome,
      my_expenses: myExpenses,
      my_withdrawals: myWithdrawals,
      my_share: myShare,
      account_balance,
      transfers
    };
  }

  const summaries = businesses.map(biz => {
    const defaultCur = biz.default_currency || 'PKR';
    const main = getBusinessSummary(biz, defaultCur);

    return {
      id: biz.id,
      name: biz.name,
      has_combined_account: biz.has_combined_account,
      share_percentage: biz.share_percentage,
      default_currency: defaultCur,
      ...main
    };
  });

  // Recent transactions across all businesses
  const businessIds = businesses.map(b => b.id);
  let recentTransactions = [];
  if (businessIds.length > 0) {
    recentTransactions = db.prepare(`
      SELECT t.*, u.name as user_name, b.name as business_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      JOIN businesses b ON t.business_id = b.id
      WHERE t.business_id IN (${businessIds.map(() => '?').join(',')})
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT 10
    `).all(...businessIds);
  }

  res.json({
    month: monthStr,
    year: yearStr,
    businesses: summaries,
    recent_transactions: recentTransactions
  });
});

module.exports = router;
