const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Given partner settlements, calculate who should pay whom
function calculateTransfers(partners) {
  const debtors = [];
  const creditors = [];

  for (const p of partners) {
    if (p.settlement < -0.5) {
      debtors.push({ id: p.id, name: p.name, amount: Math.abs(p.settlement) });
    } else if (p.settlement > 0.5) {
      creditors.push({ id: p.id, name: p.name, amount: p.settlement });
    }
  }

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
router.get('/', async (req, res) => {
  try {
    const { business_id, month, year, currency } = req.query;
    if (!business_id || !month || !year) {
      return res.status(400).json({ error: 'business_id, month, year required' });
    }

    // Verify access
    if (req.user.role === 'partner') {
      const access = await db.get('SELECT 1 FROM business_partners WHERE business_id = $1 AND user_id = $2',
        [business_id, req.user.id]);
      if (!access) return res.status(403).json({ error: 'No access' });
    }

    const monthStr = month.toString().padStart(2, '0');
    const cur = currency || 'PKR';
    const safeCur = cur === 'GBP' ? 'GBP' : 'PKR';

    // Get partners and shares
    const partners = await db.all(`
      SELECT u.id, u.name, bp.share_percentage
      FROM business_partners bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.business_id = $1
    `, [business_id]);

    // Get total income
    const totalIncomeRow = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = $1 AND type = 'income'
      AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
    `, [business_id, monthStr, year, safeCur]);
    const totalIncome = parseFloat(totalIncomeRow.total);

    // Get combined income
    const combinedIncomeRow = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = $1 AND type = 'income' AND source = 'combined'
      AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
    `, [business_id, monthStr, year, safeCur]);
    const combinedIncome = parseFloat(combinedIncomeRow.total);

    // Get total expenses
    const totalExpensesRow = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = $1 AND type = 'expense'
      AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
    `, [business_id, monthStr, year, safeCur]);
    const totalExpenses = parseFloat(totalExpensesRow.total);

    // Get total withdrawals
    const totalWithdrawalsRow = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE business_id = $1 AND type = 'withdrawal'
      AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
    `, [business_id, monthStr, year, safeCur]);
    const totalWithdrawals = parseFloat(totalWithdrawalsRow.total);

    const profit = totalIncome - totalExpenses;
    const combinedBalance = combinedIncome - totalWithdrawals;

    // Per-partner breakdown
    const partnerBreakdown = [];
    for (const p of partners) {
      const piRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND user_id = $2 AND type = 'income' AND source = 'personal'
        AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
      `, [business_id, p.id, monthStr, year, safeCur]);
      const personalIncome = parseFloat(piRow.total);

      const peRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND user_id = $2 AND type = 'expense'
        AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
      `, [business_id, p.id, monthStr, year, safeCur]);
      const personalExpenses = parseFloat(peRow.total);

      const pwRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND user_id = $2 AND type = 'withdrawal'
        AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
      `, [business_id, p.id, monthStr, year, safeCur]);
      const withdrawals = parseFloat(pwRow.total);

      const profitShare = profit * (parseFloat(p.share_percentage) / 100);
      const netPosition = (personalIncome + withdrawals) - personalExpenses;
      const settlement = profitShare - netPosition;

      partnerBreakdown.push({
        id: p.id,
        name: p.name,
        share_percentage: parseFloat(p.share_percentage),
        personal_income: personalIncome,
        personal_expenses: personalExpenses,
        withdrawals,
        profit_share: profitShare,
        net_position: netPosition,
        settlement
      });
    }

    // Income by partner
    const incomeByPartner = await db.all(`
      SELECT u.name, COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.business_id = $1 AND t.type = 'income' AND t.source = 'personal'
      AND TO_CHAR(t.date, 'MM') = $2 AND TO_CHAR(t.date, 'YYYY') = $3 AND t.currency = $4
      GROUP BY t.user_id, u.name
    `, [business_id, monthStr, year, safeCur]);

    // Expenses by partner
    const expensesByPartner = await db.all(`
      SELECT u.name, COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.business_id = $1 AND t.type = 'expense'
      AND TO_CHAR(t.date, 'MM') = $2 AND TO_CHAR(t.date, 'YYYY') = $3 AND t.currency = $4
      GROUP BY t.user_id, u.name
    `, [business_id, monthStr, year, safeCur]);

    // Expense categories
    const expensesByCategory = await db.all(`
      SELECT CASE WHEN category = '' THEN 'Uncategorized' ELSE category END as category,
             COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE business_id = $1 AND type = 'expense'
      AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
      GROUP BY category
      ORDER BY total DESC
    `, [business_id, monthStr, year, safeCur]);

    // Daily totals for chart
    const dailyData = await db.all(`
      SELECT date,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE business_id = $1
      AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
      GROUP BY date
      ORDER BY date
    `, [business_id, monthStr, year, safeCur]);

    // Calculate transfers
    const transfers = calculateTransfers(partnerBreakdown);

    // Withdrawals by partner
    const withdrawalsByPartner = await db.all(`
      SELECT u.name, COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.business_id = $1 AND t.type = 'withdrawal'
      AND TO_CHAR(t.date, 'MM') = $2 AND TO_CHAR(t.date, 'YYYY') = $3 AND t.currency = $4
      GROUP BY t.user_id, u.name
    `, [business_id, monthStr, year, safeCur]);

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard summary - all businesses for a partner
router.get('/dashboard', async (req, res) => {
  try {
    if (req.user.role !== 'partner') {
      return res.status(403).json({ error: 'Partners only' });
    }

    const now = new Date();
    const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = now.getFullYear().toString();

    const businesses = await db.all(`
      SELECT b.*, bp.share_percentage
      FROM businesses b
      JOIN business_partners bp ON b.id = bp.business_id
      WHERE bp.user_id = $1
    `, [req.user.id]);

    async function getBusinessSummary(biz, cur) {
      const totalIncomeRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND type = 'income'
        AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
      `, [biz.id, monthStr, yearStr, cur]);
      const totalIncome = parseFloat(totalIncomeRow.total);

      const totalExpensesRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND type = 'expense'
        AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
      `, [biz.id, monthStr, yearStr, cur]);
      const totalExpenses = parseFloat(totalExpensesRow.total);

      const myIncomeRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND user_id = $2 AND type = 'income' AND source = 'personal'
        AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
      `, [biz.id, req.user.id, monthStr, yearStr, cur]);
      const myIncome = parseFloat(myIncomeRow.total);

      const myExpensesRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND user_id = $2 AND type = 'expense'
        AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
      `, [biz.id, req.user.id, monthStr, yearStr, cur]);
      const myExpenses = parseFloat(myExpensesRow.total);

      const myWithdrawalsRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND user_id = $2 AND type = 'withdrawal'
        AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
      `, [biz.id, req.user.id, monthStr, yearStr, cur]);
      const myWithdrawals = parseFloat(myWithdrawalsRow.total);

      const combinedIncomeRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND type = 'income' AND source = 'combined'
        AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
      `, [biz.id, monthStr, yearStr, cur]);
      const combinedIncome = parseFloat(combinedIncomeRow.total);

      const totalWithdrawalsRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE business_id = $1 AND type = 'withdrawal'
        AND TO_CHAR(date, 'MM') = $2 AND TO_CHAR(date, 'YYYY') = $3 AND currency = $4
      `, [biz.id, monthStr, yearStr, cur]);
      const totalWithdrawals = parseFloat(totalWithdrawalsRow.total);

      const profit = totalIncome - totalExpenses;
      const myShare = profit * (parseFloat(biz.share_percentage) / 100);

      const account_balance = biz.has_combined_account && cur === 'PKR'
        ? combinedIncome - totalWithdrawals
        : totalIncome - totalExpenses;

      const allPartners = await db.all(`
        SELECT u.id, u.name, bp.share_percentage
        FROM business_partners bp
        JOIN users u ON bp.user_id = u.id
        WHERE bp.business_id = $1
      `, [biz.id]);

      const partnerBreakdown = [];
      for (const p of allPartners) {
        const pIncomeRow = await db.get(`
          SELECT COALESCE(SUM(amount), 0) as total FROM transactions
          WHERE business_id = $1 AND user_id = $2 AND type = 'income' AND source = 'personal'
          AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
        `, [biz.id, p.id, monthStr, yearStr, cur]);

        const pExpensesRow = await db.get(`
          SELECT COALESCE(SUM(amount), 0) as total FROM transactions
          WHERE business_id = $1 AND user_id = $2 AND type = 'expense'
          AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
        `, [biz.id, p.id, monthStr, yearStr, cur]);

        const pWithdrawalsRow = await db.get(`
          SELECT COALESCE(SUM(amount), 0) as total FROM transactions
          WHERE business_id = $1 AND user_id = $2 AND type = 'withdrawal'
          AND TO_CHAR(date, 'MM') = $3 AND TO_CHAR(date, 'YYYY') = $4 AND currency = $5
        `, [biz.id, p.id, monthStr, yearStr, cur]);

        const pIncome = parseFloat(pIncomeRow.total);
        const pExpenses = parseFloat(pExpensesRow.total);
        const pWithdrawals = parseFloat(pWithdrawalsRow.total);
        const profitShare = profit * (parseFloat(p.share_percentage) / 100);
        const netPosition = (pIncome + pWithdrawals) - pExpenses;
        const settlement = profitShare - netPosition;

        partnerBreakdown.push({ id: p.id, name: p.name, share_percentage: parseFloat(p.share_percentage), settlement });
      }

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

    const summaries = [];
    for (const biz of businesses) {
      const defaultCur = biz.default_currency || 'PKR';
      const main = await getBusinessSummary(biz, defaultCur);
      summaries.push({
        id: biz.id,
        name: biz.name,
        has_combined_account: biz.has_combined_account,
        share_percentage: parseFloat(biz.share_percentage),
        default_currency: defaultCur,
        ...main
      });
    }

    // Recent transactions across all businesses
    const businessIds = businesses.map(b => b.id);
    let recentTransactions = [];
    if (businessIds.length > 0) {
      const placeholders = businessIds.map((_, i) => `$${i + 1}`).join(',');
      recentTransactions = await db.all(`
        SELECT t.*, u.name as user_name, b.name as business_name
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        JOIN businesses b ON t.business_id = b.id
        WHERE t.business_id IN (${placeholders})
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 10
      `, businessIds);
    }

    res.json({
      month: monthStr,
      year: yearStr,
      businesses: summaries,
      recent_transactions: recentTransactions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
