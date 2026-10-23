import crypto from 'crypto';
import { query } from '../db/index.js';

function mapRowToDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    inquiryId: row.inquiry_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    cloudinaryUrl: row.cloudinary_url,
    publicId: row.public_id || '',
    resourceType: row.resource_type || 'auto',
    storageProvider: row.storage_provider || 'cloudinary',
    summary: row.summary || '',
    uploadedAt: row.uploaded_at ? new Date(row.uploaded_at) : new Date(),
  };
}

export default class Document {
  constructor(data) {
    if (!data) return;
    this.id = data.id || data._id;
    this._id = this.id;
    this.inquiryId = data.inquiryId;
    this.fileName = data.fileName;
    this.mimeType = data.mimeType;
    this.cloudinaryUrl = data.cloudinaryUrl;
    this.publicId = data.publicId || '';
    this.resourceType = data.resourceType || 'auto';
    this.storageProvider = data.storageProvider || 'cloudinary';
    this.summary = data.summary || '';
    this.uploadedAt = data.uploadedAt ? new Date(data.uploadedAt) : new Date();
  }

  toObject() {
    return { ...this };
  }

  static find(filter = {}) {
    let orderBy = 'uploaded_at DESC';

    const chain = {
      sort(sortObj) {
        if (sortObj) {
          if (sortObj.uploadedAt === 1 || sortObj.uploaded_at === 1) orderBy = 'uploaded_at ASC';
          else orderBy = 'uploaded_at DESC';
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
        const res = await query(`SELECT * FROM documents ${where} ORDER BY ${orderBy}`, params);
        return res.rows.map(mapRowToDocument);
      },
      then(resolve, reject) {
        return chain.lean().then(resolve, reject);
      },
    };

    return chain;
  }

  static findOne(filter = {}) {
    const chain = {
      async lean() {
        const id = filter._id || filter.id;
        const inquiryId = filter.inquiryId;

        const params = [];
        const conditions = [];

        if (id) {
          params.push(id);
          conditions.push(`id = $${params.length}`);
        }
        if (inquiryId) {
          params.push(inquiryId);
          conditions.push(`inquiry_id = $${params.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const res = await query(`SELECT * FROM documents ${where} LIMIT 1`, params);
        if (res.rows.length === 0) return null;
        return mapRowToDocument(res.rows[0]);
      },
      async exec() {
        const doc = await chain.lean();
        return doc ? new Document(doc) : null;
      },
      then(resolve, reject) {
        return chain.exec().then(resolve, reject);
      },
    };

    return chain;
  }

  static async findById(id) {
    if (!id) return null;
    const res = await query('SELECT * FROM documents WHERE id = $1 LIMIT 1', [id]);
    if (res.rows.length === 0) return null;
    return new Document(mapRowToDocument(res.rows[0]));
  }

  static async create(docData) {
    const id = docData.id || docData._id || crypto.randomBytes(12).toString('hex');
    const {
      inquiryId,
      fileName,
      mimeType,
      cloudinaryUrl,
      publicId = '',
      resourceType = 'auto',
      storageProvider = 'cloudinary',
      summary = '',
      uploadedAt = new Date(),
    } = docData;

    const res = await query(
      `INSERT INTO documents (
         id, inquiry_id, file_name, mime_type, cloudinary_url, public_id,
         resource_type, storage_provider, summary, uploaded_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        inquiryId,
        fileName,
        mimeType,
        cloudinaryUrl,
        publicId,
        resourceType,
        storageProvider,
        summary,
        uploadedAt,
      ]
    );

    const doc = mapRowToDocument(res.rows[0]);
    return new Document(doc);
  }

  static findByIdAndUpdate(id, update = {}, options = {}) {
    const chain = {
      async lean() {
        const setFields = update.$set || update;
        const summary = setFields.summary;

        const res = await query(
          `UPDATE documents
           SET summary = COALESCE($1, summary)
           WHERE id = $2
           RETURNING *`,
          [summary, id]
        );

        if (res.rows.length === 0) return null;
        return mapRowToDocument(res.rows[0]);
      },
      then(resolve, reject) {
        return chain.lean().then(resolve, reject);
      },
    };

    return chain;
  }

  static async deleteOne(filter = {}) {
    const id = filter._id || filter.id;
    const inquiryId = filter.inquiryId;

    const params = [];
    const conditions = [];

    if (id) {
      params.push(id);
      conditions.push(`id = $${params.length}`);
    }
    if (inquiryId) {
      params.push(inquiryId);
      conditions.push(`inquiry_id = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query(`DELETE FROM documents ${where} RETURNING *`, params);
    return { deletedCount: res.rowCount };
  }
}
