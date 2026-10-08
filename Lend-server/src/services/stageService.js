import Inquiry from '../models/Inquiry.js';
import { BORROWER_STAGES, INVESTOR_STAGES, DEFAULT_STAGE } from '../constants/stages.js';
import { validateStageUpdate } from '../validators/stageUpdate.js';
import { isValidId, ID_PATTERNS, sanitizeLog } from '../utils/security.js';

const STAGE_CHANGE_ACTION = 'STAGE_CHANGE';

/**
 * Update inquiry stage with validation and activity log.
 * - Fetches inquiry by id
 * - Validates stage against inquiry.type (Borrower → BORROWER_STAGES, Investor → INVESTOR_STAGES)
 * - Updates stage and lastActivityAt
 * - Appends to activityLogs
 * @param {string} inquiryId - Inquiry id (e.g. INQ-001)
 * @param {string} newStage - New stage (must be valid for inquiry type)
 * @returns {Promise<{ success: true, inquiry: object } | { success: false, status: number, message: string }>}
 */
export async function updateInquiryStage(inquiryId, newStage) {
  if (!isValidId(inquiryId, ID_PATTERNS.inquiry)) {
    return { success: false, status: 400, message: 'Invalid inquiry ID format' };
  }

  const inquiry = await Inquiry.findOne({ id: inquiryId }).lean();
  if (!inquiry) {
    return { success: false, status: 404, message: 'Inquiry not found' };
  }

  const inquiryType = inquiry.type;
  const validation = validateStageUpdate({ stage: newStage }, inquiryType);
  if (!validation.success) {
    const firstError = validation.error.errors?.[0]?.message ?? 'Invalid stage';
    return { success: false, status: 400, message: sanitizeLog(firstError, 200) };
  }

  const stage = validation.stage;
  const oldStage = inquiry.stage || DEFAULT_STAGE;

  const activityLog = {
    action: STAGE_CHANGE_ACTION,
    oldStage,
    newStage: stage,
    changedAt: new Date(),
  };

  const updated = await Inquiry.findOneAndUpdate(
    { id: inquiryId },
    {
      $set: {
        stage,
        lastActivityAt: new Date(),
        lastActivity: `Stage updated to ${stage}`,
      },
      $push: {
        activityLogs: activityLog,
      },
    },
    { new: true, runValidators: true }
  ).lean();

  return { success: true, inquiry: updated };
}

export { BORROWER_STAGES, INVESTOR_STAGES, DEFAULT_STAGE };
