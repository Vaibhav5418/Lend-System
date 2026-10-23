import { query } from '../db/index.js';

export default class Staff {
  constructor(row) {
    if (!row) return;
    this.id = row.id;
    this.name = row.name;
    this.order = row.display_order ?? 0;
  }

  static find() {
    let orderBy = 'display_order ASC';

    const chain = {
      sort(sortObj) {
        if (sortObj && (sortObj.order === -1 || sortObj.display_order === -1)) {
          orderBy = 'display_order DESC';
        } else {
          orderBy = 'display_order ASC';
        }
        return chain;
      },
      select(_fields) {
        return chain;
      },
      async lean() {
        const res = await query(`SELECT name, display_order as "order" FROM staff ORDER BY ${orderBy}`);
        return res.rows;
      },
      then(resolve, reject) {
        return chain.lean().then(resolve, reject);
      },
    };

    return chain;
  }
}
