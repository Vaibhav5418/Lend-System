import mongoose from 'mongoose';

const proposalHistorySchema = new mongoose.Schema({
  proposedLoanAmount: Number,
  proposedInterestRate: Number,
  proposedTenure: Number,
  notes: { type: String, default: '' },
  action: { type: String, enum: ['Sent', 'Accepted', 'Rejected', 'Counter'], required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const proposalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // PROP-001
  inquiryId: { type: String, required: true },
  borrowerName: { type: String, default: '' },

  // Original terms from inquiry
  originalLoanAmount: { type: Number, default: 0 },
  originalInterestRate: { type: Number, default: 0 },
  originalTenure: { type: Number, default: 0 },

  // Current proposed terms
  proposedLoanAmount: { type: Number, required: true },
  proposedInterestRate: { type: Number, required: true },
  proposedTenure: { type: Number, required: true },

  notes: { type: String, default: '' },

  status: {
    type: String,
    enum: ['Sent', 'Accepted', 'Rejected', 'Counter', 'Expired'],
    default: 'Sent',
  },

  sentAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },

  history: { type: [proposalHistorySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

proposalSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

proposalSchema.index({ inquiryId: 1 });
proposalSchema.index({ status: 1 });

export default mongoose.model('Proposal', proposalSchema);
