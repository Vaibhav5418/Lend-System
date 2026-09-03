import mongoose from 'mongoose';

const linkedBorrowerSchema = new mongoose.Schema({
  loanId: { type: String, required: true },
  allocatedAmount: { type: Number, required: true },
}, { _id: false });

const investorInvestmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // INV-001
  inquiryId: { type: String, required: true },         // Reference to original inquiry

  investorName: { type: String, required: true },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },

  investedAmount: { type: Number, required: true },
  interestRate: { type: Number, required: true },       // Stored as annual %
  interestRateType: { type: String, enum: ['monthly', 'yearly'], default: 'yearly' },
  tenureMonths: { type: Number, required: true },
  investmentPlan: { type: String, enum: ['1', '3', '6', '12', 'custom'], default: 'custom' },

  payoutFrequency: { type: String, enum: ['monthly', 'quarterly', 'on_maturity'], default: 'monthly' },
  monthlyInterest: { type: Number, default: 0 },       // Auto-calculated
  totalInterest: { type: Number, default: 0 },          // Auto-calculated
  totalPayout: { type: Number, default: 0 },             // principal + totalInterest

  startDate: { type: Date, required: true },
  maturityDate: { type: Date },

  linkedBorrowers: { type: [linkedBorrowerSchema], default: [] },

  status: {
    type: String,
    enum: ['Active', 'Matured', 'Closed', 'Withdrawn'],
    default: 'Active',
  },

  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Auto-calculate interest fields before saving
investorInvestmentSchema.pre('save', function (next) {
  const annualRate = this.interestRateType === 'monthly'
    ? this.interestRate * 12
    : this.interestRate;

  this.monthlyInterest = Math.round((this.investedAmount * annualRate / 12 / 100) * 100) / 100;
  this.totalInterest = Math.round(this.monthlyInterest * this.tenureMonths * 100) / 100;
  this.totalPayout = this.investedAmount + this.totalInterest;

  if (this.startDate && this.tenureMonths) {
    const maturity = new Date(this.startDate);
    maturity.setMonth(maturity.getMonth() + this.tenureMonths);
    this.maturityDate = maturity;
  }

  this.updatedAt = new Date();
  next();
});

investorInvestmentSchema.index({ inquiryId: 1 });
investorInvestmentSchema.index({ status: 1 });

export default mongoose.model('InvestorInvestment', investorInvestmentSchema);
