import {z} from 'zod';
export const parentHomeSchema=z.object({stage:z.enum(['READY','CONNECTED','WAITING','ATTENTION','START','UNAVAILABLE']),schools:z.array(z.string()).max(200),learners:z.array(z.object({name:z.string(),schoolName:z.string(),reference:z.string(),canPlan:z.boolean()})).max(100),canOpenAccount:z.boolean(),canPlan:z.boolean(),accessCheckIncomplete:z.boolean(),hasSchoolHistory:z.boolean(),moreAvailable:z.boolean()}).strict();
export type ParentHomeState=z.infer<typeof parentHomeSchema>;
