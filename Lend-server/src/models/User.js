import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/index.js';

export default class User {
  constructor(row) {
    if (!row) return;
    this.id = row.id;
    this.name = row.name;
    this.email = row.email;
    this.password = row.password;
    this.role = row.role || 'Super Admin';
    this.createdAt = row.created_at ? new Date(row.created_at) : new Date();
  }

  get _id() {
    return {
      toString: () => this.id,
      toJSON: () => this.id,
    };
  }

  async comparePassword(candidate) {
    if (!candidate || !this.password) return false;
    return bcrypt.compare(candidate, this.password);
  }

  async save() {
    // If password is not yet bcrypt hashed (bcrypt hashes start with $2a$ or $2b$ and are 60 chars)
    let hashed = this.password;
    if (this.password && (!this.password.startsWith('$2') || this.password.length < 59)) {
      hashed = await bcrypt.hash(this.password, 10);
      this.password = hashed;
    }

    const res = await query(
      `UPDATE users
       SET name = $1, email = $2, password = $3, role = $4
       WHERE id = $5
       RETURNING id, name, email, password, role, created_at`,
      [this.name, this.email.trim().toLowerCase(), hashed, this.role, this.id]
    );

    if (res.rows[0]) {
      this.name = res.rows[0].name;
      this.email = res.rows[0].email;
      this.password = res.rows[0].password;
      this.role = res.rows[0].role;
    }
    return this;
  }

  static async findOne(filter = {}) {
    if (filter.email) {
      const res = await query(
        `SELECT id, name, email, password, role, created_at
         FROM users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [filter.email.trim().toLowerCase()]
      );
      if (res.rows.length === 0) return null;
      return new User(res.rows[0]);
    }

    if (filter.id || filter._id) {
      return this.findById(filter.id || filter._id);
    }

    return null;
  }

  static async findById(id) {
    if (!id || typeof id !== 'string') return null;
    const res = await query(
      `SELECT id, name, email, password, role, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return new User(res.rows[0]);
  }

  static async create(userData) {
    const { name, email, password, role = 'Super Admin' } = userData;
    const cleanEmail = email.trim().toLowerCase();
    const id = userData.id || crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);

    const res = await query(
      `INSERT INTO users (id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, password, role, created_at`,
      [id, name.trim(), cleanEmail, hashedPassword, role]
    );

    return new User(res.rows[0]);
  }
}
