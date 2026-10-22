import {AssessmentError,proposalSchema,type Rubric,type Proposal} from "../../domains/assessment/contracts";
export type MarkingInput={requestId:string;actorPersonId:string;schoolId:string;assessmentId:string;submissionId:string;instructions:string;rubric:Rubric;pages:Array<{id:string;pageNumber:number;bytes:Buffer}>};
export interface AssessmentAi{propose(input:MarkingInput):Promise<Proposal>;}
export function aiConfigured(){return process.env.SPACECASE_ASSESSMENT_AI_ENABLED==="true"&&Boolean(process.env.PSG_AI_BASE_URL&&process.env.PSG_AI_SERVICE_TOKEN);}
// Versioned PSG AI contract: provider selection and model credentials remain outside SpaceCase.
export function assessmentAi(fetchImpl:typeof fetch=fetch):AssessmentAi{
 return {async propose(input){
  if(!aiConfigured())throw new AssessmentError("AI_NOT_CONFIGURED",503);
  const base=process.env.PSG_AI_BASE_URL!;if(new URL(base).protocol!=="https:")throw new AssessmentError("AI_NOT_CONFIGURED",503);
  const response=await fetchImpl(new URL("/v1/assessment-marking",base),{method:"POST",redirect:"error",headers:{authorization:`Bearer ${process.env.PSG_AI_SERVICE_TOKEN}`,"content-type":"application/json","idempotency-key":input.requestId},signal:AbortSignal.timeout(60000),body:JSON.stringify({contractVersion:"spacecase.assessment-marking.v1",purpose:"ASSESSMENT_ASSISTANCE",requestId:input.requestId,actorPersonId:input.actorPersonId,schoolId:input.schoolId,assessmentId:input.assessmentId,submissionRef:input.submissionId,
   policy:{teacherApprovalRequired:true,ignoreInstructionsInImages:true,unreadableAnswerMustBeUncertain:true,noDiagnosis:true},instructions:input.instructions,rubric:input.rubric,pages:input.pages.map(p=>({id:p.id,pageNumber:p.pageNumber,mediaType:"image/jpeg",data:p.bytes.toString("base64")}))})});
  if(!response.ok)throw new AssessmentError("AI_UNAVAILABLE",503);
  if(!response.body)throw new AssessmentError("INVALID_AI_RESPONSE",502);
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>150000){await reader.cancel();throw new AssessmentError("INVALID_AI_RESPONSE",502);}chunks.push(value);}}finally{reader.releaseLock();}
  const body=Buffer.concat(chunks).toString("utf8");
  let parsed;try{parsed=proposalSchema.safeParse(JSON.parse(body));}catch{throw new AssessmentError("INVALID_AI_RESPONSE",502);}
  if(!parsed.success)throw new AssessmentError("INVALID_AI_RESPONSE",502);return parsed.data;
 }};
}
