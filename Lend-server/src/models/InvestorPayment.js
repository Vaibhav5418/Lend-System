import { query } from '../db/index.js';

function mapRowToPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    investmentId: row.investment_id,
    investorName: row.investor_name || '',
    paymentDate: row.payment_date ? new Date(row.payment_date) : new Date(),
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    amountPaid: Number(row.amount_paid || 0),
    interestPaid: Number(row.interest_paid || 0),
    principalPaid: Number(row.principal_paid || 0),
    pendingInterest: Number(row.pending_interest || 0),
    paymentFrequency: row.payment_frequency || 'monthly',
    paymentMode: row.payment_mode || 'Bank Transfer',
    status: row.status || 'Pending',
    remarks: row.remarks || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

export default class InvestorPayment {
  constructor(data) {
    if (!data) return;
    Object.assign(this, data);
  }

  toObject() {
    return { ...this };
  }

  calculateFields() {
    this.amountPaid = (this.interestPaid || 0) + (this.principalPaid || 0);
  }

  async save() {
    this.calculateFields();

    try {
      const res = await query(
        `INSERT INTO investor_payments (
           id, investment_id, investor_name, payment_date, due_date,
           amount_paid, interest_paid, principal_paid, pending_interest,
           payment_frequency, payment_mode, status, remarks, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           investor_name = EXCLUDED.investor_name,
           payment_date = EXCLUDED.payment_date,
           due_date = EXCLUDED.due_date,
           amount_paid = EXCLUDED.amount_paid,
           interest_paid = EXCLUDED.interest_paid,
           principal_paid = EXCLUDED.principal_paid,
           pending_interest = EXCLUDED.pending_interest,
           payment_frequency = EXCLUDED.payment_frequency,
           payment_mode = EXCLUDED.payment_mode,
           status = EXCLUDED.status,
           remarks = EXCLUDED.remarks
         RETURNING *`,
        [
          this.id,
          this.investmentId,
          this.investorName || '',
          this.paymentDate ? new Date(this.paymentDate) : new Date(),
          this.dueDate ? new Date(this.dueDate) : null,
          this.amountPaid || 0,
          this.interestPaid || 0,
          this.principalPaid || 0,
          this.pendingInterest || 0,
          this.paymentFrequency || 'monthly',
          this.paymentMode || 'Bank Transfer',
          this.status || 'Pending',
          this.remarks || '',
          this.createdAt ? new Date(this.createdAt) : new Date(),
        ]
      );

      if (res.rows[0]) {
        Object.assign(this, mapRowToPayment(res.rows[0]));
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
    let orderBy = 'payment_date DESC';

    const chain = {
      sort(sortObj) {
        if (sortObj) {
          if (sortObj.paymentDate === 1 || sortObj.payment_date === 1) orderBy = 'payment_date ASC';
          else orderBy = 'payment_date DESC';
        }
        return chain;
      },
      select(_fields) {
        return chain;
      },
      async lean() {
        const params = [];
        let where = '';
        if (filter.investmentId) {
          params.push(filter.investmentId);
          where = 'WHERE investment_id = $1';
        }
        const res = await query(`SELECT * FROM investor_payments ${where} ORDER BY ${orderBy}`, params);
        return res.rows.map(mapRowToPayment);
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
        const res = await query(`SELECT ${selectFields} FROM investor_payments ${where} ORDER BY ${orderBy} LIMIT 1`, params);
        if (res.rows.length === 0) return null;
        return mapRowToPayment(res.rows[0]);
      },
      async exec() {
        const data = await chain.lean();
        return data ? new InvestorPayment(data) : null;
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
    const res = await query('DELETE FROM investor_payments WHERE id = $1 RETURNING *', [id]);
    if (res.rows.length === 0) return null;
    return mapRowToPayment(res.rows[0]);
  }
}
