import { query } from '../db/index.js';

function mapRowToInquiry(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    name: row.name || '',
    mobile: row.mobile || '',
    email: row.email || '',
    city: row.city || '',
    source: row.source,
    priority: row.priority,
    assignedTo: row.assigned_to || '',
    referenceAgent: row.reference_agent || undefined,
    stage: row.stage || 'NEW',
    nextFollowUp: row.next_follow_up || undefined,
    turnover: row.turnover || undefined,
    lastActivity: row.last_activity || 'Inquiry created',
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    notes: row.notes || '',
    activityLogs: Array.isArray(row.activity_logs) ? row.activity_logs : [],
    combinedReportMarkdown: row.combined_report_markdown || undefined,
    combinedReportGeneratedAt: row.combined_report_generated_at ? new Date(row.combined_report_generated_at) : undefined,
    profileScore: row.profile_score != null ? Number(row.profile_score) : undefined,
    profileScoreRating: row.profile_score_rating || undefined,
    borrowerDetails: row.borrower_details || undefined,
    investorDetails: row.investor_details || undefined,
  };
}

export default class Inquiry {
  constructor(data) {
    Object.assign(this, data);
  }

  toObject() {
    return { ...this };
  }

  static find(filter = {}) {
    let orderBy = 'id ASC';

    const chain = {
      sort(sortObj) {
        if (sortObj) {
          if (sortObj.id === 1) orderBy = 'id ASC';
          else if (sortObj.id === -1) orderBy = 'id DESC';
          else if (sortObj.createdAt === -1 || sortObj.created_at === -1) orderBy = 'created_at DESC';
          else if (sortObj.createdAt === 1 || sortObj.created_at === 1) orderBy = 'created_at ASC';
          else if (sortObj._id === -1) orderBy = 'id DESC';
        }
        return chain;
      },
      select(_fields) {
        return chain;
      },
      async lean() {
        const params = [];
        let where = '';
        if (filter.type) {
          params.push(filter.type);
          where += ` WHERE type = $${params.length}`;
        }
        if (filter.stage) {
          params.push(filter.stage);
          where += where ? ` AND stage = $${params.length}` : ` WHERE stage = $${params.length}`;
        }
        const sql = `SELECT * FROM inquiries ${where} ORDER BY ${orderBy}`;
        const res = await query(sql, params);
        return res.rows.map(mapRowToInquiry);
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
          else if (sortObj.created_at === -1 || sortObj.createdAt === -1) orderBy = 'created_at DESC';
        }
        return chain;
      },
      select(fields) {
        if (typeof fields === 'string' && fields.trim() === 'type') {
          selectFields = 'id, type';
        } else if (typeof fields === 'string' && fields.trim() === 'id') {
          selectFields = 'id';
        }
        return chain;
      },
      async lean() {
        const params = [];
        let whereClause = '';

        if (filter.id) {
          params.push(filter.id);
          whereClause = 'WHERE id = $1';
        } else if (filter._id) {
          params.push(filter._id);
          whereClause = 'WHERE id = $1';
        }

        const sql = `SELECT ${selectFields} FROM inquiries ${whereClause} ORDER BY ${orderBy} LIMIT 1`;
        const res = await query(sql, params);
        if (res.rows.length === 0) return null;
        return mapRowToInquiry(res.rows[0]);
      },
      then(resolve, reject) {
        return chain.lean().then(resolve, reject);
      },
    };

    return chain;
  }

  static async create(inquiryData) {
    const {
      id,
      type,
      name = '',
      mobile = '',
      email = '',
      city = '',
      source,
      priority,
      assignedTo = '',
      referenceAgent = null,
      stage = 'NEW',
      nextFollowUp = null,
      turnover = null,
      lastActivity = 'Inquiry created',
      lastActivityAt = new Date(),
      createdAt = new Date(),
      notes = '',
      activityLogs = [],
      combinedReportMarkdown = null,
      combinedReportGeneratedAt = null,
      profileScore = null,
      profileScoreRating = null,
      borrowerDetails = null,
      investorDetails = null,
    } = inquiryData;

    try {
      const res = await query(
        `INSERT INTO inquiries (
           id, type, name, mobile, email, city, source, priority, assigned_to,
           reference_agent, stage, next_follow_up, turnover, last_activity,
           last_activity_at, created_at, notes, activity_logs, combined_report_markdown,
           combined_report_generated_at, profile_score, profile_score_rating,
           borrower_details, investor_details
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19,
           $20, $21, $22,
           $23, $24
         )
         RETURNING *`,
        [
          id,
          type,
          name,
          mobile,
          email,
          city,
          source,
          priority,
          assignedTo,
          referenceAgent,
          stage,
          nextFollowUp,
          turnover,
          lastActivity,
          lastActivityAt,
          createdAt,
          notes,
          JSON.stringify(activityLogs),
          combinedReportMarkdown,
          combinedReportGeneratedAt,
          profileScore,
          profileScoreRating,
          borrowerDetails ? JSON.stringify(borrowerDetails) : null,
          investorDetails ? JSON.stringify(investorDetails) : null,
        ]
      );

      const obj = mapRowToInquiry(res.rows[0]);
      return new Inquiry(obj);
    } catch (err) {
      if (err.code === '23505') {
        err.code = 11000; // Match Mongo duplicate key error code for retries
      }
      throw err;
    }
  }

  static findOneAndUpdate(filter = {}, update = {}, options = {}) {
    const chain = {
      async lean() {
        const id = filter.id || filter._id;
        if (!id) return null;

        // Fetch current document first
        const currentRes = await query('SELECT * FROM inquiries WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) return null;
        const current = mapRowToInquiry(currentRes.rows[0]);

        const setFields = update.$set || {};
        const pushFields = update.$push || {};

        let newActivityLogs = [...(current.activityLogs || [])];
        if (pushFields.activityLogs) {
          newActivityLogs.push(pushFields.activityLogs);
        }

        const updatedData = {
          ...current,
          ...setFields,
          activityLogs: newActivityLogs,
        };

        // Handle nested dot notation like 'borrowerDetails.loanAmount'
        for (const [key, val] of Object.entries(setFields)) {
          if (key.startsWith('borrowerDetails.')) {
            const subKey = key.split('.')[1];
            updatedData.borrowerDetails = {
              ...(updatedData.borrowerDetails || {}),
              [subKey]: val,
            };
          } else if (key.startsWith('investorDetails.')) {
            const subKey = key.split('.')[1];
            updatedData.investorDetails = {
              ...(updatedData.investorDetails || {}),
              [subKey]: val,
            };
          }
        }

        const res = await query(
          `UPDATE inquiries SET
             name = COALESCE($1, name),
             mobile = COALESCE($2, mobile),
             email = COALESCE($3, email),
             city = COALESCE($4, city),
             source = COALESCE($5, source),
             priority = COALESCE($6, priority),
             assigned_to = COALESCE($7, assigned_to),
             reference_agent = COALESCE($8, reference_agent),
             stage = COALESCE($9, stage),
             next_follow_up = COALESCE($10, next_follow_up),
             turnover = COALESCE($11, turnover),
             last_activity = COALESCE($12, last_activity),
             last_activity_at = COALESCE($13, last_activity_at),
             notes = COALESCE($14, notes),
             activity_logs = $15,
             combined_report_markdown = COALESCE($16, combined_report_markdown),
             combined_report_generated_at = COALESCE($17, combined_report_generated_at),
             profile_score = COALESCE($18, profile_score),
             profile_score_rating = COALESCE($19, profile_score_rating),
             borrower_details = COALESCE($20, borrower_details),
             investor_details = COALESCE($21, investor_details)
           WHERE id = $22
           RETURNING *`,
          [
            updatedData.name,
            updatedData.mobile,
            updatedData.email,
            updatedData.city,
            updatedData.source,
            updatedData.priority,
            updatedData.assignedTo,
            updatedData.referenceAgent,
            updatedData.stage,
            updatedData.nextFollowUp,
            updatedData.turnover,
            updatedData.lastActivity,
            updatedData.lastActivityAt ? new Date(updatedData.lastActivityAt) : new Date(),
            updatedData.notes,
            JSON.stringify(updatedData.activityLogs),
            updatedData.combinedReportMarkdown ?? null,
            updatedData.combinedReportGeneratedAt ? new Date(updatedData.combinedReportGeneratedAt) : null,
            updatedData.profileScore ?? null,
            updatedData.profileScoreRating ?? null,
            updatedData.borrowerDetails ? JSON.stringify(updatedData.borrowerDetails) : null,
            updatedData.investorDetails ? JSON.stringify(updatedData.investorDetails) : null,
            id,
          ]
        );

        if (res.rows.length === 0) return null;
        return mapRowToInquiry(res.rows[0]);
      },
      then(resolve, reject) {
        return chain.lean().then(resolve, reject);
      },
    };

    return chain;
  }

  static async findOneAndDelete(filter = {}) {
    const id = filter.id || filter._id;
    if (!id) return null;

    const res = await query('DELETE FROM inquiries WHERE id = $1 RETURNING *', [id]);
    if (res.rows.length === 0) return null;
    return mapRowToInquiry(res.rows[0]);
  }
}
