import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  inquiryId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  mimeType: { type: String },
  cloudinaryUrl: { type: String, required: true }, // URL to open/download (Cloudinary or Supabase public URL)
  publicId: { type: String, default: '' }, // Cloudinary public_id, or Supabase storage path for delete
  resourceType: { type: String, default: 'auto' }, // 'raw' for PDFs/docs so they open in browser
  storageProvider: { type: String, enum: ['cloudinary', 'supabase'], default: 'cloudinary' },
  summary: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Document', documentSchema);
