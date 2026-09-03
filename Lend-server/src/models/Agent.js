import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  totalInquiries: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
});

agentSchema.index({ totalInquiries: -1 });

export default mongoose.model('Agent', agentSchema);
