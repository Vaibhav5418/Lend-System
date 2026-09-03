import mongoose from 'mongoose';

const borrowerDetailsSchema = new mongoose.Schema({
  loanAmount: Number,
  tenure: Number,
  proposedInterest: Number,
}, { _id: false });

const investorDetailsSchema = new mongoose.Schema({
  investmentAmount: Number,
  expectedInterest: Number,
  tenure: Number,
  frequency: { type: String, enum: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'], default: 'Monthly' },
}, { _id: false });

const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    oldStage: String,
    newStage: String,
    changedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const inquirySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['Borrower', 'Investor'] },
  name: { type: String, default: '' },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },
  city: { type: String, default: '' },
  source: { type: String, required: true, enum: ['Website', 'Referral', 'Walk-in', 'Social Media', 'Agent', 'Existing Client'] },
  priority: { type: String, required: true, enum: ['Hot', 'Warm', 'Cold'] },
  assignedTo: { type: String, default: '' },
  referenceAgent: String,
  stage: { type: String, required: true, default: 'NEW' },
  nextFollowUp: String,
  turnover: String,
  lastActivity: { type: String, required: true },
  lastActivityAt: { type: Date },
  createdAt: { type: String, required: true },
  notes: { type: String, default: '' },
  activityLogs: { type: [activityLogSchema], default: [] },
  combinedReportMarkdown: String,
  combinedReportGeneratedAt: Date,
  profileScore: Number,
  profileScoreRating: String,
  borrowerDetails: borrowerDetailsSchema,
  investorDetails: investorDetailsSchema,
});

inquirySchema.index({ type: 1 });
inquirySchema.index({ stage: 1 });
inquirySchema.index({ assignedTo: 1 });
inquirySchema.index({ createdAt: -1 });

export default mongoose.model('Inquiry', inquirySchema);
