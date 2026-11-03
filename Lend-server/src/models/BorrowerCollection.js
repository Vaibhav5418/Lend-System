import { query } from '../db/index.js';

export function mapRowToCollection(row) {
  if (!row) return null;
  return {
    id: row.id,
    loanId: row.loan_id,
    borrowerName: row.borrower_name || '',
    paymentDate: row.payment_date ? new Date(row.payment_date) : new Date(),
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    scheduleMonth: row.schedule_month != null ? Number(row.schedule_month) : undefined,
    interestPaid: Number(row.interest_paid || 0),
    principalPaid: Number(row.principal_paid || 0),
    totalPaid: Number(row.total_paid || 0),
    pendingAmount: Number(row.pending_amount || 0),
    overdueDays: Number(row.overdue_days || 0),
    penalty: Number(row.penalty || 0),
    paymentMode: row.payment_mode || 'Bank Transfer',
    status: row.status || 'Pending',
    remarks: row.remarks || '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

export default class BorrowerCollection {
  constructor(data) {
    if (!data) return;
    Object.assign(this, data);
  }

  toObject() {
    return { ...this };
  }

  calculateFields() {
    this.totalPaid = (this.interestPaid || 0) + (this.principalPaid || 0);

    if (this.dueDate && this.status !== 'Received') {
      const now = new Date();
      const due = new Date(this.dueDate);
      const diffMs = now.getTime() - due.getTime();
      if (diffMs > 0) {
        this.overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      } else {
        this.overdueDays = 0;
      }
    }
  }

  async save() {
    this.calculateFields();

    try {
      const res = await query(
        `INSERT INTO borrower_collections (
           id, loan_id, borrower_name, payment_date, due_date, schedule_month,
           interest_paid, principal_paid, total_paid, pending_amount,
           overdue_days, penalty, payment_mode, status, remarks, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           borrower_name = EXCLUDED.borrower_name,
           payment_date = EXCLUDED.payment_date,
           due_date = EXCLUDED.due_date,
           schedule_month = EXCLUDED.schedule_month,
           interest_paid = EXCLUDED.interest_paid,
           principal_paid = EXCLUDED.principal_paid,
           total_paid = EXCLUDED.total_paid,
           pending_amount = EXCLUDED.pending_amount,
           overdue_days = EXCLUDED.overdue_days,
           penalty = EXCLUDED.penalty,
           payment_mode = EXCLUDED.payment_mode,
           status = EXCLUDED.status,
           remarks = EXCLUDED.remarks
         RETURNING *`,
        [
          this.id,
          this.loanId,
          this.borrowerName || '',
          this.paymentDate ? new Date(this.paymentDate) : new Date(),
          this.dueDate ? new Date(this.dueDate) : null,
          this.scheduleMonth ?? null,
          this.interestPaid || 0,
          this.principalPaid || 0,
          this.totalPaid || 0,
          this.pendingAmount || 0,
          this.overdueDays || 0,
          this.penalty || 0,
          this.paymentMode || 'Bank Transfer',
          this.status || 'Pending',
          this.remarks || '',
          this.createdAt ? new Date(this.createdAt) : new Date(),
        ]
      );

      if (res.rows[0]) {
        Object.assign(this, mapRowToCollection(res.rows[0]));
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
        if (filter.loanId) {
          params.push(filter.loanId);
          where = 'WHERE loan_id = $1';
        }
        const res = await query(`SELECT * FROM borrower_collections ${where} ORDER BY ${orderBy}`, params);
        return res.rows.map(mapRowToCollection);
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
        const res = await query(`SELECT ${selectFields} FROM borrower_collections ${where} ORDER BY ${orderBy} LIMIT 1`, params);
        if (res.rows.length === 0) return null;
        return mapRowToCollection(res.rows[0]);
      },
      async exec() {
        const data = await chain.lean();
        return data ? new BorrowerCollection(data) : null;
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
    const res = await query('DELETE FROM borrower_collections WHERE id = $1 RETURNING *', [id]);
    if (res.rows.length === 0) return null;
    return mapRowToCollection(res.rows[0]);
  }
}
