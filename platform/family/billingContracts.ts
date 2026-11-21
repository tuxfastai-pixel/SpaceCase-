import {z} from 'zod';
const uuid=z.string().uuid().transform(v=>v.toLowerCase());
export const familyBillingActions=['family.finance.read','family.finance.plan.accept','family.finance.proof.submit'] as const;
export const familyBillingAction=z.enum(familyBillingActions);
export const familyBillingDecision=z.object({allowed:z.literal(true),contractVersion:z.literal('family-billing-v1'),grantId:uuid,personId:uuid,schoolId:uuid,learnerPersonId:uuid,action:familyBillingAction,expiresAt:z.string().datetime()}).strict();
export type FamilyBillingDecision=z.infer<typeof familyBillingDecision>;
const scopeSchema=z.object({grantId:uuid,schoolId:uuid,learnerPersonId:uuid,schoolName:z.string().max(200),learnerReference:z.string().max(80),givenName:z.string().max(200),familyName:z.string().max(200),actions:z.array(familyBillingAction).min(1).max(3),expiresAt:z.string().datetime()}).strict();
export const familyBillingDirectory=z.object({contractVersion:z.literal('family-billing-v1'),scopes:z.array(scopeSchema).max(100),truncated:z.boolean()}).strict().refine(v=>new Set(v.scopes.map(s=>s.grantId)).size===v.scopes.length&&v.scopes.every(s=>s.actions.includes('family.finance.read')));
