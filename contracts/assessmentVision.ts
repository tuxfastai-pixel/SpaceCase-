import {z} from "zod";
const id=z.string().uuid().transform(v=>v.toLowerCase());
const text=(max:number)=>z.string().max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
export const pageReadingSchema=z.object({pageId:id,transcription:text(12000),uncertain:z.boolean(),warnings:z.array(text(500)).max(10)}).strict();
export const readingResultSchema=z.object({executionId:text(160).refine(Boolean),modelRef:text(160).refine(Boolean),policyVersion:text(80).refine(Boolean),pages:z.array(pageReadingSchema).min(1).max(10)}).strict();
export const readingReviewSchema=z.array(z.object({pageId:id,transcription:text(12000),uncertain:z.boolean(),reviewed:z.literal(true)}).strict()).min(1).max(10);
export type ReadingResult=z.infer<typeof readingResultSchema>;
export type ReadingReview=z.infer<typeof readingReviewSchema>;
const image=z.object({id,pageNumber:z.number().int().min(1).max(10),mediaType:z.literal("image/jpeg"),data:z.string().min(1).max(2800000)}).strict();
const envelope={contractVersion:z.literal("spacecase.assessment-vision.v2"),requestId:id,actorPersonId:id,schoolId:id,assessmentId:id,submissionRef:id,sourceRevision:z.number().int().min(1),inputHash:z.string().regex(/^[a-f0-9]{64}$/),pages:z.array(image).min(1).max(10)};
const question=z.object({id,label:text(40),prompt:text(2000),expectedAnswer:text(4000),maxMarks:z.number().int().min(1).max(1000)}).strict();
export const visionRequestSchema=z.discriminatedUnion("mode",[
 z.object({...envelope,mode:z.literal("READ"),purpose:z.literal("ASSESSMENT_READING")}).strict(),
 z.object({...envelope,mode:z.literal("MARK"),purpose:z.literal("ASSESSMENT_ASSISTANCE"),instructions:text(4000),rubric:z.array(question).min(1).max(50),reviewedReadings:readingReviewSchema}).strict(),
]);
export type VisionRequest=z.infer<typeof visionRequestSchema>;
export function exactPages(ids:string[],pages:Array<{pageId:string}>){return pages.length===ids.length&&new Set(pages.map(p=>p.pageId)).size===ids.length&&pages.every(p=>ids.includes(p.pageId));}
export const claimSchema=z.object({requestId:id,actorPersonId:id,schoolId:id,assessmentId:id,submissionRef:id,sourceRevision:z.number().int().min(1),inputHash:z.string().regex(/^[a-f0-9]{64}$/),mode:z.enum(["READ","MARK"])}).strict();
