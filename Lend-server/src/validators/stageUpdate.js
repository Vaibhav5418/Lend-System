import { z } from 'zod';
import { BORROWER_STAGES, INVESTOR_STAGES } from '../constants/stages.js';

const borrowerStageSchema = z.enum([...BORROWER_STAGES]);
const investorStageSchema = z.enum([...INVESTOR_STAGES]);

/**
 * Validates PATCH /api/inquiries/:id/stage body.
 * Use with inquiry type to validate stage belongs to that type.
 * @param {object} data - { stage: string }
 * @param {'Borrower'|'Investor'} inquiryType
 * @returns {{ success: true, stage: string } | { success: false, error: z.ZodError }}
 */
export function validateStageUpdate(data, inquiryType) {
  const schema = z.object({ stage: z.string().min(1, 'stage is required') });
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error };

  const stageSchema = inquiryType === 'Borrower' ? borrowerStageSchema : investorStageSchema;
  const stageParsed = stageSchema.safeParse(parsed.data.stage);
  if (!stageParsed.success) return { success: false, error: stageParsed.error };

  return { success: true, stage: stageParsed.data };
}
