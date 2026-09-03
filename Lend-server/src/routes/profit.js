import { Router } from 'express';
import InvestorInvestment from '../models/InvestorInvestment.js';
import InvestorPayment from '../models/InvestorPayment.js';
import BorrowerLoan from '../models/BorrowerLoan.js';
import BorrowerCollection from '../models/BorrowerCollection.js';

const router = Router();

/**
 * GET /api/profit/dashboard
 * Returns platform profit engine metrics.
 * Matches NBFC / P2P spread accounting logic.
 */
router.get('/dashboard', async (_req, res) => {
  try {
    const [investments, loans, investorPayments, collections] = await Promise.all([
      InvestorInvestment.find().lean(),
      BorrowerLoan.find().lean(),
      InvestorPayment.find().lean(),
      BorrowerCollection.find().lean(),
    ]);

    // ─── Fund Totals ──────────────────────────────────────────────
    const totalInvestedFunds = investments.reduce((s, i) => s + (i.investedAmount || 0), 0);
    const activeInvestedFunds = investments
      .filter(i => i.status === 'Active')
      .reduce((s, i) => s + (i.investedAmount || 0), 0);

    const totalDeployedFunds = loans.reduce((s, l) => s + (l.approvedAmount || 0), 0);
    const activeDeployedFunds = loans
      .filter(l => l.status === 'Active')
      .reduce((s, l) => s + (l.approvedAmount || 0), 0);

    // ─── Interest Totals ──────────────────────────────────────────
    // Interest payable = total interest owed to investors
    const totalInterestPayable = investments.reduce((s, i) => s + (i.totalInterest || 0), 0);
    const interestPaidToInvestors = investorPayments
      .filter(p => p.status === 'Paid')
      .reduce((s, p) => s + (p.interestPaid || 0), 0);

    // Interest receivable = total interest owed by borrowers
    const totalInterestReceivable = loans.reduce((s, l) => s + (l.totalInterest || 0), 0);
    const interestCollectedFromBorrowers = collections
      .filter(c => c.status === 'Received')
      .reduce((s, c) => s + (c.interestPaid || 0), 0);

    // ─── Spread Profit ────────────────────────────────────────────
    const netSpreadProfit = totalInterestReceivable - totalInterestPayable;
    const realizedProfit = interestCollectedFromBorrowers - interestPaidToInvestors;

    // ─── Monthly Breakdown (last 12 months) — Optimized ───────────────────
    const monthlyProfit = [];
    const now = new Date();

    // Pre-calculate month labels and ranges
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
        label: `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
      });
    }

    // Group collections and payments by month once
    const collectionsByMonth = collections.filter(c => c.status === 'Received');
    const paymentsByMonth = investorPayments.filter(p => p.status === 'Paid');

    for (const m of months) {
      const monthCollected = collectionsByMonth
        .filter(c => {
          const d = new Date(c.paymentDate);
          return d >= m.start && d <= m.end;
        })
        .reduce((s, c) => s + (c.interestPaid || 0), 0);

      const monthPaid = paymentsByMonth
        .filter(p => {
          const d = new Date(p.paymentDate);
          return d >= m.start && d <= m.end;
        })
        .reduce((s, p) => s + (p.interestPaid || 0), 0);

      monthlyProfit.push({
        month: m.label,
        interestCollected: Math.round(monthCollected * 100) / 100,
        interestPaid: Math.round(monthPaid * 100) / 100,
        netProfit: Math.round((monthCollected - monthPaid) * 100) / 100,
      });
    }

    // ─── Counts ───────────────────────────────────────────────────
    const activeInvestors = investments.filter(i => i.status === 'Active').length;
    const activeLoans = loans.filter(l => l.status === 'Active').length;
    const defaultedLoans = loans.filter(l => l.status === 'Defaulted').length;

    // ─── Avg rates (normalise to annual before averaging) ────────
    const avgInvestorRate = activeInvestors > 0
      ? investments.filter(i => i.status === 'Active')
        .reduce((s, i) => s + (i.interestRateType === 'monthly' ? i.interestRate * 12 : i.interestRate), 0) / activeInvestors
      : 0;
    const avgBorrowerRate = activeLoans > 0
      ? loans.filter(l => l.status === 'Active')
        .reduce((s, l) => s + (l.interestRateType === 'monthly' ? l.interestRate * 12 : l.interestRate), 0) / activeLoans
      : 0;

    res.json({
      totalInvestedFunds: Math.round(totalInvestedFunds * 100) / 100,
      activeInvestedFunds: Math.round(activeInvestedFunds * 100) / 100,
      totalDeployedFunds: Math.round(totalDeployedFunds * 100) / 100,
      activeDeployedFunds: Math.round(activeDeployedFunds * 100) / 100,
      totalInterestPayable: Math.round(totalInterestPayable * 100) / 100,
      interestPaidToInvestors: Math.round(interestPaidToInvestors * 100) / 100,
      totalInterestReceivable: Math.round(totalInterestReceivable * 100) / 100,
      interestCollectedFromBorrowers: Math.round(interestCollectedFromBorrowers * 100) / 100,
      netSpreadProfit: Math.round(netSpreadProfit * 100) / 100,
      realizedProfit: Math.round(realizedProfit * 100) / 100,
      avgInvestorRate: Math.round(avgInvestorRate * 100) / 100,
      avgBorrowerRate: Math.round(avgBorrowerRate * 100) / 100,
      avgSpread: Math.round((avgBorrowerRate - avgInvestorRate) * 100) / 100,
      activeInvestors,
      activeLoans,
      defaultedLoans,
      monthlyProfit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
