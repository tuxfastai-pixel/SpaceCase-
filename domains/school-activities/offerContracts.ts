import {z} from 'zod';
export const offerReferences=z.array(z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/).transform(v=>v.toUpperCase())).min(1).max(50).refine(v=>new Set(v).size===v.length);
export const batchOfferInput=z.object({activityId:z.string().uuid(),revision:z.number().int().positive(),references:offerReferences,eligibilityChecked:z.literal(true)}).strict();
export const pickerLearner=z.object({personId:z.string().uuid(),admissionNumber:z.string().min(1).max(40),givenName:z.string().max(80),familyName:z.string().max(80)}).strict();
export const learnerPickerData=z.object({contractVersion:z.literal('finance-learner-picker-v1'),classes:z.array(z.object({id:z.string().uuid(),name:z.string().max(200),year:z.number().int().nullable()})).max(100),classesTruncated:z.boolean(),learners:z.array(pickerLearner).max(50),truncated:z.boolean(),nextCursor:z.string().uuid().nullable()}).strict();
