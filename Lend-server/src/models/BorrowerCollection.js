import mongoose from 'mongoose';

const borrowerCollectionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // COL-001
  loanId: { type: String, required: true },
  borrowerName: { type: String, default: '' },

  paymentDate: { type: Date, required: true },
  dueDate: { type: Date },
  scheduleMonth: { type: Number },                     // Links to repaymentSchedule month

  interestPaid: { type: Number, default: 0 },
  principalPaid: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },

  overdueDays: { type: Number, default: 0 },
  penalty: { type: Number, default: 0 },

  paymentMode: {
    type: String,
    enum: ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'Other'],
    default: 'Bank Transfer',
  },

  status: {
    type: String,
    enum: ['Received', 'Pending', 'Overdue', 'Partial', 'Defaulted'],
    default: 'Pending',
  },

  remarks: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

borrowerCollectionSchema.pre('save', function (next) {
  this.totalPaid = (this.interestPaid || 0) + (this.principalPaid || 0);

  if (this.dueDate && this.status !== 'Received') {
    const now = new Date();
    const due = new Date(this.dueDate);
    const diffMs = now.getTime() - due.getTime();
    if (diffMs > 0) {
      this.overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }
  next();
});

borrowerCollectionSchema.index({ loanId: 1 });
borrowerCollectionSchema.index({ status: 1 });
borrowerCollectionSchema.index({ dueDate: 1 });

export default mongoose.model('BorrowerCollection', borrowerCollectionSchema);
