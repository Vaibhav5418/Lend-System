import { query } from '../db/index.js';

function mapRowToInvestment(row) {
  if (!row) return null;
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    investorName: row.investor_name,
    mobile: row.mobile || '',
    email: row.email || '',
    investedAmount: Number(row.invested_amount || 0),
    interestRate: Number(row.interest_rate || 0),
    interestRateType: row.interest_rate_type || 'yearly',
    tenureMonths: Number(row.tenure_months || 0),
    investmentPlan: row.investment_plan || 'custom',
    payoutFrequency: row.payout_frequency || 'monthly',
    monthlyInterest: Number(row.monthly_interest || 0),
    totalInterest: Number(row.total_interest || 0),
    totalPayout: Number(row.total_payout || 0),
    startDate: row.start_date ? new Date(row.start_date) : new Date(),
    maturityDate: row.maturity_date ? new Date(row.maturity_date) : undefined,
    linkedBorrowers: Array.isArray(row.linked_borrowers) ? row.linked_borrowers : [],
    status: row.status || 'Active',
    notes: row.notes || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

export default class InvestorInvestment {
  constructor(data) {
    if (!data) return;
    Object.assign(this, data);
    this.linkedBorrowers = Array.isArray(data.linkedBorrowers) ? [...data.linkedBorrowers] : [];
  }

  toObject() {
    return { ...this };
  }

  calculateFinancials() {
    const annualRate = this.interestRateType === 'monthly'
      ? this.interestRate * 12
      : this.interestRate;

    this.monthlyInterest = Math.round((this.investedAmount * annualRate / 12 / 100) * 100) / 100;
    this.totalInterest = Math.round(this.monthlyInterest * this.tenureMonths * 100) / 100;
    this.totalPayout = this.investedAmount + this.totalInterest;

    if (this.startDate && this.tenureMonths) {
      const maturity = new Date(this.startDate);
      maturity.setMonth(maturity.getMonth() + this.tenureMonths);
      this.maturityDate = maturity;
    }
  }

  async save() {
    this.calculateFinancials();
    this.updatedAt = new Date();

    try {
      const res = await query(
        `INSERT INTO investor_investments (
           id, inquiry_id, investor_name, mobile, email, invested_amount,
           interest_rate, interest_rate_type, tenure_months, investment_plan,
           payout_frequency, monthly_interest, total_interest, total_payout,
           start_date, maturity_date, linked_borrowers, status, notes,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
         )
         ON CONFLICT (id) DO UPDATE SET
           investor_name = EXCLUDED.investor_name,
           mobile = EXCLUDED.mobile,
           email = EXCLUDED.email,
           invested_amount = EXCLUDED.invested_amount,
           interest_rate = EXCLUDED.interest_rate,
           interest_rate_type = EXCLUDED.interest_rate_type,
           tenure_months = EXCLUDED.tenure_months,
           investment_plan = EXCLUDED.investment_plan,
           payout_frequency = EXCLUDED.payout_frequency,
           monthly_interest = EXCLUDED.monthly_interest,
           total_interest = EXCLUDED.total_interest,
           total_payout = EXCLUDED.total_payout,
           start_date = EXCLUDED.start_date,
           maturity_date = EXCLUDED.maturity_date,
           linked_borrowers = EXCLUDED.linked_borrowers,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [
          this.id,
          this.inquiryId,
          this.investorName,
          this.mobile || '',
          this.email || '',
          this.investedAmount,
          this.interestRate,
          this.interestRateType || 'yearly',
          this.tenureMonths,
          this.investmentPlan || 'custom',
          this.payoutFrequency || 'monthly',
          this.monthlyInterest,
          this.totalInterest,
          this.totalPayout,
          this.startDate ? new Date(this.startDate) : new Date(),
          this.maturityDate ? new Date(this.maturityDate) : null,
          JSON.stringify(this.linkedBorrowers),
          this.status || 'Active',
          this.notes || '',
          this.createdAt ? new Date(this.createdAt) : new Date(),
          this.updatedAt,
        ]
      );

      if (res.rows[0]) {
        Object.assign(this, mapRowToInvestment(res.rows[0]));
      }
      return this;
    } catch (err) {
      if (err.code === '23505') {
        err.code = 11000;
      }
      throw err;
    }
  }

  static find(filter = {}) {
    let orderBy = 'created_at DESC';

    const chain = {
      sort(sortObj) {
        if (sortObj) {
          if (sortObj.createdAt === 1 || sortObj.created_at === 1) orderBy = 'created_at ASC';
          else orderBy = 'created_at DESC';
        }
        return chain;
      },
      select(_fields) {
        return chain;
      },
      async lean() {
        const params = [];
        let where = '';
        if (filter.status) {
          params.push(filter.status);
          where = 'WHERE status = $1';
        }
        const res = await query(`SELECT * FROM investor_investments ${where} ORDER BY ${orderBy}`, params);
        return res.rows.map(mapRowToInvestment);
      },
      then(resolve, reject) {
        return chain.lean().then(resolve, reject);
      },
    };

    return chain;
  }

  static findOne(filter = {}) {
    let selectFields = '*';
    let orderBy = 'id DESC';

    const chain = {
      sort(sortObj) {
        if (sortObj) {
          if (sortObj._id === -1 || sortObj.id === -1) orderBy = 'id DESC';
          else if (sortObj._id === 1 || sortObj.id === 1) orderBy = 'id ASC';
        }
        return chain;
      },
      select(fields) {
        if (typeof fields === 'string' && fields.trim() === 'id') {
          selectFields = 'id';
        }
        return chain;
      },
      async lean() {
        const params = [];
        let where = '';
        if (filter.id) {
          params.push(filter.id);
          where = 'WHERE id = $1';
        }
        const res = await query(`SELECT ${selectFields} FROM investor_investments ${where} ORDER BY ${orderBy} LIMIT 1`, params);
        if (res.rows.length === 0) return null;
        return mapRowToInvestment(res.rows[0]);
      },
      async exec() {
        const data = await chain.lean();
        return data ? new InvestorInvestment(data) : null;
      },
      then(resolve, reject) {
        return chain.exec().then(resolve, reject);
      },
    };

    return chain;
  }

  static async findOneAndDelete(filter = {}) {
    const id = filter.id || filter._id;
    if (!id) return null;
    const res = await query('DELETE FROM investor_investments WHERE id = $1 RETURNING *', [id]);
    if (res.rows.length === 0) return null;
    return mapRowToInvestment(res.rows[0]);
  }
}
