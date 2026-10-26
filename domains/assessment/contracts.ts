import {z} from "zod";
import {readingReviewSchema} from "../../contracts/assessmentVision";
export const uuid=z.string().uuid().transform(v=>v.toLowerCase());
const text=(max:number,min=0)=>z.string().trim().min(min).max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),"Remove unsupported characters");
const score=z.number().finite().min(0).max(1000).refine(v=>Number.isInteger(v*10),"Use marks in steps of 0.1");
export class AssessmentError extends Error{constructor(public code:string,public status=403){super(code);}}
export const questionSchema=z.object({id:uuid,label:text(40,1),prompt:text(2000,1),expectedAnswer:text(4000,1),maxMarks:z.number().int().min(1).max(1000)}).strict();
const rubricList=z.array(questionSchema).max(50).superRefine((qs,ctx)=>{
 if(new Set(qs.map(q=>q.id)).size!==qs.length)ctx.addIssue({code:"custom",message:"Question references must be unique"});
 if(new Set(qs.map(q=>q.label.toLowerCase())).size!==qs.length)ctx.addIssue({code:"custom",message:"Question labels must be unique"});
 if(qs.reduce((n,q)=>n+q.maxMarks,0)>1000)ctx.addIssue({code:"custom",message:"An assessment can have at most 1,000 marks"});
});
export const rubricSchema=rubricList.refine(qs=>qs.length>0,"Add at least one complete question and memorandum before opening.");
export const draftRubricSchema=rubricList;
export type Rubric=z.infer<typeof rubricSchema>;
export const assessmentInput=z.object({id:uuid,title:text(160,1),subject:text(80,1),instructions:text(4000),rubric:draftRubricSchema}).strict();
export type AssessmentInput=z.infer<typeof assessmentInput>;
export const reviewScores=z.array(z.object({questionId:uuid,marks:score,feedback:text(2000),reviewed:z.literal(true)}).strict()).min(1).max(50);
export type ReviewScores=z.infer<typeof reviewScores>;
export const actionSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("OPEN"),revision:z.number().int().min(1)}).strict(),
 z.object({action:z.literal("EDIT"),revision:z.number().int().min(1),definition:assessmentInput}).strict(),
 z.object({action:z.literal("MATCH"),pageId:uuid,revision:z.number().int().min(1),learnerId:uuid,pageNumber:z.number().int().min(1).max(10)}).strict(),
 z.object({action:z.literal("REMOVE_PAGE"),pageId:uuid,revision:z.number().int().min(1)}).strict(),
 z.object({action:z.literal("CONFIRM_PAGES"),submissionId:uuid,revision:z.number().int().min(1)}).strict(),
 z.object({action:z.literal("SAVE_REVIEW"),submissionId:uuid,revision:z.number().int().min(1),scores:reviewScores}).strict(),
 z.object({action:z.literal("APPROVE"),submissionId:uuid,revision:z.number().int().min(1),acknowledged:z.literal(true)}).strict(),
 z.object({action:z.literal("REOPEN"),submissionId:uuid,revision:z.number().int().min(1),reason:text(1000,10)}).strict(),
 z.object({action:z.literal("READ_WORK"),submissionId:uuid,revision:z.number().int().min(1),requestId:uuid,acknowledged:z.literal(true)}).strict(),
 z.object({action:z.literal("SAVE_READING"),submissionId:uuid,revision:z.number().int().min(1),pages:readingReviewSchema}).strict(),
 z.object({action:z.literal("ASSIST"),submissionId:uuid,revision:z.number().int().min(1),requestId:uuid,acknowledged:z.literal(true)}).strict(),
]);
export type AssessmentAction=z.infer<typeof actionSchema>;
export const proposalSchema=z.object({executionId:text(160,1),modelRef:text(160,1),policyVersion:text(80,1),
 items:z.array(z.object({questionId:uuid,marks:score.nullable(),uncertain:z.boolean(),feedback:text(2000),evidencePageIds:z.array(uuid).max(10)}).strict()).min(1).max(50),
 warnings:z.array(text(500,1)).max(20),
}).strict();
export type Proposal=z.infer<typeof proposalSchema>;
export function validateScores(rubric:Rubric,scores:ReviewScores){
 if(!reviewScores.safeParse(scores).success)throw new AssessmentError("INVALID_SCORES",400);
 const byId=new Map(rubric.map(q=>[q.id,q]));
 if(scores.length!==rubric.length||new Set(scores.map(s=>s.questionId)).size!==rubric.length||scores.some(s=>!byId.has(s.questionId)||s.marks>byId.get(s.questionId)!.maxMarks))throw new AssessmentError("INVALID_SCORES",400);
 return Math.round(scores.reduce((n,s)=>n+s.marks,0)*10)/10;
}
export function validateProposal(rubric:Rubric,pageIds:string[],proposal:Proposal){
 const byId=new Map(rubric.map(q=>[q.id,q]));const pages=new Set(pageIds);
 if(proposal.items.length!==rubric.length||new Set(proposal.items.map(i=>i.questionId)).size!==rubric.length||proposal.items.some(i=>!byId.has(i.questionId)||(i.marks!==null&&i.marks>byId.get(i.questionId)!.maxMarks)||i.evidencePageIds.some(p=>!pages.has(p))||(i.uncertain&&i.marks!==null)||(!i.uncertain&&(i.marks===null||i.evidencePageIds.length===0))))throw new AssessmentError("INVALID_AI_RESPONSE",502);
 return proposal;
}
