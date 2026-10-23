import { query } from '../db/index.js';

function mapRowToProposal(row) {
  if (!row) return null;
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    borrowerName: row.borrower_name || '',
    originalLoanAmount: Number(row.original_loan_amount || 0),
    originalInterestRate: Number(row.original_interest_rate || 0),
    originalTenure: Number(row.original_tenure || 0),
    proposedLoanAmount: Number(row.proposed_loan_amount || 0),
    proposedInterestRate: Number(row.proposed_interest_rate || 0),
    proposedTenure: Number(row.proposed_tenure || 0),
    notes: row.notes || '',
    status: row.status || 'Sent',
    sentAt: row.sent_at ? new Date(row.sent_at) : new Date(),
    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
    history: Array.isArray(row.history) ? row.history : [],
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

export default class Proposal {
  constructor(data) {
    if (!data) return;
    Object.assign(this, data);
    this.history = Array.isArray(data.history) ? [...data.history] : [];
  }

  toObject() {
    return { ...this };
  }

  async save() {
    this.updatedAt = new Date();
    const res = await query(
      `UPDATE proposals SET
         borrower_name = $1,
         original_loan_amount = $2,
         original_interest_rate = $3,
         original_tenure = $4,
         proposed_loan_amount = $5,
         proposed_interest_rate = $6,
         proposed_tenure = $7,
         notes = $8,
         status = $9,
         responded_at = $10,
         history = $11,
         updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        this.borrowerName,
        this.originalLoanAmount,
        this.originalInterestRate,
        this.originalTenure,
        this.proposedLoanAmount,
        this.proposedInterestRate,
        this.proposedTenure,
        this.notes,
        this.status,
        this.respondedAt ? new Date(this.respondedAt) : null,
        JSON.stringify(this.history),
        this.id,
      ]
    );

    if (res.rows[0]) {
      Object.assign(this, mapRowToProposal(res.rows[0]));
    }
    return this;
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
        if (filter.inquiryId) {
          params.push(filter.inquiryId);
          where = 'WHERE inquiry_id = $1';
        }
        const res = await query(`SELECT * FROM proposals ${where} ORDER BY ${orderBy}`, params);
        return res.rows.map(mapRowToProposal);
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
        const res = await query(`SELECT ${selectFields} FROM proposals ${where} ORDER BY ${orderBy} LIMIT 1`, params);
        if (res.rows.length === 0) return null;
        return mapRowToProposal(res.rows[0]);
      },
      async exec() {
        const data = await chain.lean();
        return data ? new Proposal(data) : null;
      },
      then(resolve, reject) {
        return chain.exec().then(resolve, reject);
      },
    };

    return chain;
  }

  static async create(data) {
    const {
      id,
      inquiryId,
      borrowerName = '',
      originalLoanAmount = 0,
      originalInterestRate = 0,
      originalTenure = 0,
      proposedLoanAmount,
      proposedInterestRate,
      proposedTenure,
      notes = '',
      status = 'Sent',
      sentAt = new Date(),
      history = [],
      createdAt = new Date(),
      updatedAt = new Date(),
    } = data;

    try {
      const res = await query(
        `INSERT INTO proposals (
           id, inquiry_id, borrower_name, original_loan_amount, original_interest_rate,
           original_tenure, proposed_loan_amount, proposed_interest_rate, proposed_tenure,
           notes, status, sent_at, history, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          id,
          inquiryId,
          borrowerName,
          originalLoanAmount,
          originalInterestRate,
          originalTenure,
          proposedLoanAmount,
          proposedInterestRate,
          proposedTenure,
          notes,
          status,
          sentAt,
          JSON.stringify(history),
          createdAt,
          updatedAt,
        ]
      );

      const prop = mapRowToProposal(res.rows[0]);
      return new Proposal(prop);
    } catch (err) {
      if (err.code === '23505') {
        err.code = 11000;
      }
      throw err;
    }
  }

  static async findOneAndDelete(filter = {}) {
    const id = filter.id || filter._id;
    if (!id) return null;
    const res = await query('DELETE FROM proposals WHERE id = $1 RETURNING *', [id]);
    if (res.rows.length === 0) return null;
    return mapRowToProposal(res.rows[0]);
  }
}
