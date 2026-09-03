import mongoose from 'mongoose';

const repaymentScheduleSchema = new mongoose.Schema({
  month: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  interestDue: { type: Number, required: true },
  principalDue: { type: Number, required: true },
  totalDue: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue', 'Partial'],
    default: 'Pending',
  },
}, { _id: false });

const investorMappingSchema = new mongoose.Schema({
  investmentId: { type: String, required: true },
  allocatedAmount: { type: Number, required: true },
}, { _id: false });

const borrowerLoanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // LOAN-001
  inquiryId: { type: String, required: true },

  borrowerName: { type: String, required: true },
  companyName: { type: String, default: '' },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },

  approvedAmount: { type: Number, required: true },
  interestRate: { type: Number, required: true },        // Stored as annual %
  interestRateType: { type: String, enum: ['monthly', 'yearly'], default: 'yearly' },
  tenureMonths: { type: Number, required: true },

  repaymentType: {
    type: String,
    enum: ['Interest-Only', 'Bullet'],
    default: 'Interest-Only',
  },

  monthlyInterest: { type: Number, default: 0 },          // Auto-calculated
  totalInterest: { type: Number, default: 0 },
  totalRepayable: { type: Number, default: 0 },

  startDate: { type: Date, required: true },
  endDate: { type: Date },

  repaymentSchedule: { type: [repaymentScheduleSchema], default: [] },
  investorMapping: { type: [investorMappingSchema], default: [] },

  loanPurpose: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Active', 'Closed', 'Defaulted', 'Restructured'],
    default: 'Active',
  },

  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

borrowerLoanSchema.pre('save', function (next) {
  const annualRate = this.interestRateType === 'monthly'
    ? this.interestRate * 12
    : this.interestRate;

  const monthlyRate = annualRate / 12 / 100;
  this.monthlyInterest = Math.round(this.approvedAmount * monthlyRate * 100) / 100;
  this.totalInterest = Math.round(this.monthlyInterest * this.tenureMonths * 100) / 100;
  this.totalRepayable = this.approvedAmount + this.totalInterest;

  if (this.startDate && this.tenureMonths) {
    const end = new Date(this.startDate);
    end.setMonth(end.getMonth() + this.tenureMonths);
    this.endDate = end;
  }

  this.updatedAt = new Date();
  next();
});

borrowerLoanSchema.index({ inquiryId: 1 });
borrowerLoanSchema.index({ status: 1 });

export default mongoose.model('BorrowerLoan', borrowerLoanSchema);
