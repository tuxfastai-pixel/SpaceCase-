import {AssessmentError,proposalSchema,type Rubric,type Proposal} from "../../domains/assessment/contracts";
import {readingResultSchema,type ReadingResult,type ReadingReview} from "../../contracts/assessmentVision";
export type MarkingInput={requestId:string;actorPersonId:string;schoolId:string;assessmentId:string;submissionId:string;sourceRevision:number;inputHash:string;instructions:string;rubric:Rubric;reviewedReadings:ReadingReview;pages:Array<{id:string;pageNumber:number;bytes:Buffer}>};
export interface AssessmentAi{read(input:MarkingInput):Promise<ReadingResult>;propose(input:MarkingInput):Promise<Proposal>;}
export function aiConfigured(){return process.env.SPACECASE_ASSESSMENT_AI_ENABLED==="true"&&Boolean(process.env.PSG_AI_BASE_URL&&process.env.PSG_AI_SERVICE_TOKEN)&&Number.isInteger(Number(process.env.SPACECASE_ASSESSMENT_AI_DAILY_LIMIT))&&Number(process.env.SPACECASE_ASSESSMENT_AI_DAILY_LIMIT)>0&&Number(process.env.SPACECASE_ASSESSMENT_AI_DAILY_LIMIT)<=100;}
export function assessmentAi(fetchImpl:typeof fetch=fetch):AssessmentAi{
 async function execute(input:MarkingInput,mode:"READ"|"MARK"){
  if(!aiConfigured())throw new AssessmentError("AI_NOT_CONFIGURED",503);
  const base=process.env.PSG_AI_BASE_URL!;if(new URL(base).protocol!=="https:")throw new AssessmentError("AI_NOT_CONFIGURED",503);
  if(input.pages.reduce((n,p)=>n+p.bytes.length,0)>2097152)throw new AssessmentError("AI_IMAGES_TOO_LARGE",400);
  const payload={contractVersion:"spacecase.assessment-vision.v2",mode,purpose:mode==="READ"?"ASSESSMENT_READING":"ASSESSMENT_ASSISTANCE",requestId:input.requestId,actorPersonId:input.actorPersonId,schoolId:input.schoolId,assessmentId:input.assessmentId,submissionRef:input.submissionId,sourceRevision:input.sourceRevision,inputHash:input.inputHash,
   ...(mode==="MARK"?{instructions:input.instructions,rubric:input.rubric,reviewedReadings:input.reviewedReadings}:{}),
   pages:input.pages.map(p=>({id:p.id,pageNumber:p.pageNumber,mediaType:"image/jpeg",data:p.bytes.toString("base64")}))};
  const body=JSON.stringify(payload);if(Buffer.byteLength(body)>4000000)throw new AssessmentError("AI_IMAGES_TOO_LARGE",400);
  const response=await fetchImpl(new URL(mode==="READ"?"/v1/assessment-reading":"/v1/assessment-marking",base),{method:"POST",redirect:"error",headers:{authorization:`Bearer ${process.env.PSG_AI_SERVICE_TOKEN}`,"content-type":"application/json","idempotency-key":input.requestId},signal:AbortSignal.timeout(70000),body});
  if(!response.ok)throw new AssessmentError(response.status===429?"AI_RATE_LIMIT":"AI_UNAVAILABLE",response.status===429?429:503);
  if(!response.body)throw new AssessmentError("INVALID_AI_RESPONSE",502);
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>600000){await reader.cancel();throw new AssessmentError("INVALID_AI_RESPONSE",502);}chunks.push(value);}}finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;}catch{throw new AssessmentError("INVALID_AI_RESPONSE",502);}
 }
 return {
  async read(input){const r=readingResultSchema.safeParse(await execute(input,"READ"));if(!r.success)throw new AssessmentError("INVALID_AI_RESPONSE",502);return r.data;},
  async propose(input){const r=proposalSchema.safeParse(await execute(input,"MARK"));if(!r.success)throw new AssessmentError("INVALID_AI_RESPONSE",502);return r.data;},
 };
}
