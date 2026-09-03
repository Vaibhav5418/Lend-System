import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  order: { type: Number, default: 0 },
});

export default mongoose.model('Staff', staffSchema);
