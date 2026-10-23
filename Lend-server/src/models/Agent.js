import { query } from '../db/index.js';

export default class Agent {
  constructor(row) {
    if (!row) return;
    this.id = row.id;
    this.name = row.name;
    this.totalInquiries = Number(row.total_inquiries || 0);
    this.conversions = Number(row.conversions || 0);
  }

  static find() {
    let orderBy = 'total_inquiries DESC';

    const chain = {
      sort(sortObj) {
        if (sortObj && sortObj.totalInquiries === 1) {
          orderBy = 'total_inquiries ASC';
        } else {
          orderBy = 'total_inquiries DESC';
        }
        return chain;
      },
      select(_fields) {
        return chain;
      },
      async lean() {
        const res = await query(
          `SELECT id, name, total_inquiries as "totalInquiries", conversions
           FROM agents
           ORDER BY ${orderBy}`
        );
        return res.rows.map((r) => ({
          id: r.id,
          name: r.name,
          totalInquiries: Number(r.totalInquiries || 0),
          conversions: Number(r.conversions || 0),
        }));
      },
      then(resolve, reject) {
        return chain.lean().then(resolve, reject);
      },
    };

    return chain;
  }
}
