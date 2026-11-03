import { query } from '../db/index.js';

export function mapRowToLoan(row) {
  if (!row) return null;
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    borrowerName: row.borrower_name,
    companyName: row.company_name || '',
    mobile: row.mobile || '',
    email: row.email || '',
    approvedAmount: Number(row.approved_amount || 0),
    interestRate: Number(row.interest_rate || 0),
    interestRateType: row.interest_rate_type || 'yearly',
    tenureMonths: Number(row.tenure_months || 0),
    repaymentType: row.repayment_type || 'Interest-Only',
    monthlyInterest: Number(row.monthly_interest || 0),
    totalInterest: Number(row.total_interest || 0),
    totalRepayable: Number(row.total_repayable || 0),
    startDate: row.start_date ? new Date(row.start_date) : new Date(),
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    repaymentSchedule: Array.isArray(row.repayment_schedule) ? row.repayment_schedule : [],
    investorMapping: Array.isArray(row.investor_mapping) ? row.investor_mapping : [],
    loanPurpose: row.loan_purpose || '',
    status: row.status || 'Active',
    notes: row.notes || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

export default class BorrowerLoan {
  constructor(data) {
    if (!data) return;
    Object.assign(this, data);
    this.repaymentSchedule = Array.isArray(data.repaymentSchedule) ? [...data.repaymentSchedule] : [];
    this.investorMapping = Array.isArray(data.investorMapping) ? [...data.investorMapping] : [];
  }

  toObject() {
    return { ...this };
  }

  calculateFinancials() {
    const annualRate = this.interestRateType === 'monthly'
      ? this.interestRate * 12
      : this.interestRate;

    const monthlyRate = annualRate / 12 / 100;
    this.monthlyInterest = Math.round(this.approvedAmount * monthlyRate * 100) / 100;
    this.totalInterest = Math.round(this.monthlyInterest * this.tenureMonths * 100) / 100;
    this.totalRepayable = this.approvedAmount + this.totalInterest;

    if (this.startDate && this.tenureMonths) {
      const end = new Date(this.startDate);
      end.setMonth(end.getMonth() + this.tenureMonths);
      this.endDate = end;
    }
  }

  async save() {
    this.calculateFinancials();
    this.updatedAt = new Date();

    try {
      const res = await query(
        `INSERT INTO borrower_loans (
           id, inquiry_id, borrower_name, company_name, mobile, email,
           approved_amount, interest_rate, interest_rate_type, tenure_months,
           repayment_type, monthly_interest, total_interest, total_repayable,
           start_date, end_date, repayment_schedule, investor_mapping, loan_purpose,
           status, notes, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19,
           $20, $21, $22, $23
         )
         ON CONFLICT (id) DO UPDATE SET
           borrower_name = EXCLUDED.borrower_name,
           company_name = EXCLUDED.company_name,
           mobile = EXCLUDED.mobile,
           email = EXCLUDED.email,
           approved_amount = EXCLUDED.approved_amount,
           interest_rate = EXCLUDED.interest_rate,
           interest_rate_type = EXCLUDED.interest_rate_type,
           tenure_months = EXCLUDED.tenure_months,
           repayment_type = EXCLUDED.repayment_type,
           monthly_interest = EXCLUDED.monthly_interest,
           total_interest = EXCLUDED.total_interest,
           total_repayable = EXCLUDED.total_repayable,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           repayment_schedule = EXCLUDED.repayment_schedule,
           investor_mapping = EXCLUDED.investor_mapping,
           loan_purpose = EXCLUDED.loan_purpose,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [
          this.id,
          this.inquiryId,
          this.borrowerName,
          this.companyName || '',
          this.mobile || '',
          this.email || '',
          this.approvedAmount,
          this.interestRate,
          this.interestRateType || 'yearly',
          this.tenureMonths,
          this.repaymentType || 'Interest-Only',
          this.monthlyInterest,
          this.totalInterest,
          this.totalRepayable,
          this.startDate ? new Date(this.startDate) : new Date(),
          this.endDate ? new Date(this.endDate) : null,
          JSON.stringify(this.repaymentSchedule),
          JSON.stringify(this.investorMapping),
          this.loanPurpose || '',
          this.status || 'Active',
          this.notes || '',
          this.createdAt ? new Date(this.createdAt) : new Date(),
          this.updatedAt,
        ]
      );

      if (res.rows[0]) {
        Object.assign(this, mapRowToLoan(res.rows[0]));
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
        const res = await query(`SELECT * FROM borrower_loans ${where} ORDER BY ${orderBy}`, params);
        return res.rows.map(mapRowToLoan);
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
        const res = await query(`SELECT ${selectFields} FROM borrower_loans ${where} ORDER BY ${orderBy} LIMIT 1`, params);
        if (res.rows.length === 0) return null;
        return mapRowToLoan(res.rows[0]);
      },
      async exec() {
        const data = await chain.lean();
        return data ? new BorrowerLoan(data) : null;
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
    const res = await query('DELETE FROM borrower_loans WHERE id = $1 RETURNING *', [id]);
    if (res.rows.length === 0) return null;
    return mapRowToLoan(res.rows[0]);
  }
}
