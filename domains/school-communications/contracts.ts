import {z} from 'zod';
const uuid=z.string().uuid().toLowerCase();
export const conversationAuthority=z.discriminatedUnion('role',[
 z.object({allowed:z.literal(true),contractVersion:z.literal('finance-conversations-v1'),role:z.literal('PARENT'),learnerName:z.string().min(1).max(200),parentName:z.string().min(1).max(200),personId:uuid,schoolId:uuid,learnerPersonId:uuid,grantId:uuid,expiresAt:z.string().datetime()}).strict(),
 z.object({allowed:z.literal(true),contractVersion:z.literal('finance-conversations-v1'),role:z.literal('STAFF'),personId:uuid,schoolId:uuid,expiresAt:z.string().datetime()}).strict(),
]);
export type ConversationAuthority=z.infer<typeof conversationAuthority>;
export const messageInput=z.object({requestId:uuid,body:z.string().trim().min(1).max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/)}).strict();
export const conversationCommand=z.discriminatedUnion('command',[
 z.object({command:z.literal('MESSAGE'),message:messageInput}).strict(),
 z.object({command:z.literal('READ'),through:z.string().regex(/^(0|[1-9][0-9]{0,18})$/)}).strict(),
 z.object({command:z.enum(['RESOLVE','REOPEN']),requestId:uuid}).strict(),
]);
export type ConversationCommand=z.infer<typeof conversationCommand>;
export const parentConversationDirectory=z.object({contractVersion:z.literal('finance-conversations-v1'),personId:uuid,scopes:z.array(z.object({grantId:uuid,schoolId:uuid,learnerPersonId:uuid,schoolName:z.string().max(200),learnerReference:z.string().max(80),givenName:z.string().max(200),familyName:z.string().max(200),actions:z.array(z.enum(['family.finance.read','family.finance.plan.accept','family.finance.activity.accept','family.finance.proof.submit'])).min(1).max(4),expiresAt:z.string().datetime()}).strict()).max(100),truncated:z.boolean()}).strict().refine(d=>d.scopes.every(s=>s.actions.includes('family.finance.read'))&&new Set(d.scopes.map(s=>s.grantId)).size===d.scopes.length);
