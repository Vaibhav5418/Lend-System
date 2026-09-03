import mongoose from 'mongoose';

const investorPaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // IPAY-001
  investmentId: { type: String, required: true },      // Reference to InvestorInvestment
  investorName: { type: String, default: '' },

  paymentDate: { type: Date, required: true },
  dueDate: { type: Date },

  amountPaid: { type: Number, required: true, default: 0 },
  interestPaid: { type: Number, default: 0 },
  principalPaid: { type: Number, default: 0 },
  pendingInterest: { type: Number, default: 0 },

  paymentFrequency: { type: String, enum: ['monthly', 'quarterly', 'on_maturity'], default: 'monthly' },
  paymentMode: {
    type: String,
    enum: ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'Other'],
    default: 'Bank Transfer',
  },

  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Overdue', 'Partial'],
    default: 'Pending',
  },

  remarks: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

// Auto-calculate amountPaid before saving
investorPaymentSchema.pre('save', function (next) {
  this.amountPaid = (this.interestPaid || 0) + (this.principalPaid || 0);
  next();
});

investorPaymentSchema.index({ investmentId: 1 });
investorPaymentSchema.index({ status: 1 });
investorPaymentSchema.index({ dueDate: 1 });

export default mongoose.model('InvestorPayment', investorPaymentSchema);
