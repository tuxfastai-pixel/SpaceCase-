import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {claimHandler} from "../../platform/assessment/claim";
import {readingReviewSchema,exactPages,visionRequestSchema} from "../../contracts/assessmentVision";
test("reading review requires every page and explicit review; reading requests cannot include a memorandum",()=>{
 const pageId=randomUUID();assert.equal(readingReviewSchema.safeParse([{pageId,transcription:"Answer",uncertain:false,reviewed:false}]).success,false);
 assert.equal(exactPages([pageId],[{pageId}]),true);assert.equal(exactPages([pageId],[{pageId:randomUUID()}]),false);
 const base={contractVersion:"spacecase.assessment-vision.v2",mode:"READ",purpose:"ASSESSMENT_READING",requestId:randomUUID(),actorPersonId:randomUUID(),schoolId:randomUUID(),assessmentId:randomUUID(),submissionRef:randomUUID(),sourceRevision:1,inputHash:"b".repeat(64),pages:[{id:pageId,pageNumber:1,mediaType:"image/jpeg",data:"AA=="}]};
 assert.equal(visionRequestSchema.safeParse(base).success,true);assert.equal(visionRequestSchema.safeParse({...base,rubric:[]}).success,false);
});
test("internal execution claims reject unsigned and disabled calls before opening a pool",async()=>{
 const old=process.env.PSG_AI_SERVICE_TOKEN;const flag=process.env.SPACECASE_ASSESSMENT_AI_ENABLED;const token="test-service-token-with-more-than-32-characters";
 const handler=claimHandler(()=>{throw new Error("No pool expected");});try{
  process.env.PSG_AI_SERVICE_TOKEN=token;assert.equal((await handler(new Request("https://example/claim",{method:"POST"}))).status,401);
  process.env.SPACECASE_ASSESSMENT_AI_ENABLED="false";assert.equal((await handler(new Request("https://example/claim",{method:"POST",headers:{authorization:`Bearer ${token}`},body:"{}"}))).status,503);
 }finally{if(old===undefined)delete process.env.PSG_AI_SERVICE_TOKEN;else process.env.PSG_AI_SERVICE_TOKEN=old;if(flag===undefined)delete process.env.SPACECASE_ASSESSMENT_AI_ENABLED;else process.env.SPACECASE_ASSESSMENT_AI_ENABLED=flag;}
});
