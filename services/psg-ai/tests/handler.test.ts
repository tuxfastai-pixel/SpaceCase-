import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {serviceHandler} from "../lib/handler";
const token="synthetic-test-service-token-32-characters";
const pageId=randomUUID();const input={contractVersion:"spacecase.assessment-vision.v2",mode:"READ",purpose:"ASSESSMENT_READING",requestId:randomUUID(),actorPersonId:randomUUID(),schoolId:randomUUID(),assessmentId:randomUUID(),submissionRef:randomUUID(),sourceRevision:1,inputHash:"a".repeat(64),pages:[{id:pageId,pageNumber:1,mediaType:"image/jpeg",data:Buffer.from([255,216,255,0]).toString("base64")}]};
function req(body:unknown=input,authenticated=true){return new Request("https://psg.example/v1/assessment-reading",{method:"POST",headers:{...(authenticated?{authorization:`Bearer ${token}`} :{}),"idempotency-key":input.requestId},body:JSON.stringify(body)});}
async function withConfig(fn:()=>Promise<void>){const env={PSG_AI_SERVICE_TOKEN:token,PSG_AI_EXECUTION_ENABLED:"true",PSG_AI_MODEL:"test/vision",AI_GATEWAY_API_KEY:"test-credential",PSG_PRODUCT_BASE_URL:"https://product.example"};const old=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);try{await fn();}finally{for(const k of Object.keys(env)){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}}
test("gateway authenticates before parsing images and stays disabled until activated",()=>withConfig(async()=>{
 let calls=0;const handler=serviceHandler("READ",async()=>{calls++;throw new Error("No request expected");});
 assert.equal((await handler(req({},false))).status,401);process.env.PSG_AI_EXECUTION_ENABLED="false";assert.equal((await handler(req())).status,503);assert.equal(calls,0);
}));
test("reading omits memorandum, needs a durable permit, and rejects hallucinated page IDs",()=>withConfig(async()=>{
 let permitted=true,calls=0,wrong=false;
 const fetcher=(async(url,options)=>{
  const target=String(url);
  if(target.endsWith("/models"))return Response.json({data:[{id:"test/vision",type:"language",zdr:"all",no_training:"all",tags:["vision","structured-output"],modalities:{input:["image","text"]}}]});
  if(target.includes("/claim")){assert.equal(target,"https://product.example/api/internal/assessment-ai/claim");assert.equal(JSON.parse(options!.body as string).mode,"READ");return permitted?Response.json({allowed:true}):Response.json({}, {status:409});}
  calls++;const body=JSON.parse(options!.body as string);assert.equal(body.tools,undefined);assert.equal(body.model,"test/vision");assert.equal(body.response_format.type,"json_schema");assert.equal(body.providerOptions.gateway.zeroDataRetention,true);assert.equal(body.providerOptions.gateway.disallowPromptTraining,true);assert.equal(JSON.stringify(body).includes("expectedAnswer"),false);
  return Response.json({id:"test-generation",choices:[{finish_reason:"stop",message:{content:JSON.stringify({pages:[{pageId:wrong?randomUUID():pageId,transcription:"[illegible]",uncertain:true,warnings:["Text is unclear"]}]})}}]});
 }) as typeof fetch;
 const handler=serviceHandler("READ",fetcher);const response=await handler(req());assert.equal(response.status,200);assert.equal((await response.json()).pages[0].uncertain,true);
 permitted=false;assert.equal((await handler(req())).status,409);assert.equal(calls,1);
 permitted=true;wrong=true;assert.equal((await handler(req())).status,502);
}));
test("model retention policy fails before claiming or disclosing photos",()=>withConfig(async()=>{
 let calls=0;const handler=serviceHandler("READ",(async()=>{calls++;return Response.json({data:[{id:"test/vision",type:"language",zdr:"none",no_training:"all",tags:["vision","structured-output"],modalities:{input:["image"]}}]});}) as typeof fetch);
 assert.equal((await handler(req())).status,503);assert.equal(calls,1);
}));
test("marking abstains on unresolved page readings and never returns an approval",()=>withConfig(async()=>{
 const question=randomUUID();const body={...input,mode:"MARK",purpose:"ASSESSMENT_ASSISTANCE",instructions:"Use the rubric",rubric:[{id:question,label:"1",prompt:"1+1",expectedAnswer:"2",maxMarks:2}],reviewedReadings:[{pageId,transcription:"[illegible]",uncertain:true,reviewed:true}]};let abstain=false;
 const handler=serviceHandler("MARK",(async(url)=>{
  if(String(url).endsWith("/models"))return Response.json({data:[{id:"test/vision",type:"language",zdr:"all",no_training:"all",tags:["vision","structured-output"],modalities:{input:["image"]}}]});
  if(String(url).includes("/claim"))return Response.json({allowed:true});
  return Response.json({id:"test-mark",choices:[{finish_reason:"stop",message:{content:JSON.stringify({items:[{questionId:question,marks:abstain?null:2,uncertain:abstain,feedback:"Check original",evidencePageIds:[pageId]}],warnings:[]})}}]});
 }) as typeof fetch);
 assert.equal((await handler(req(body))).status,502);abstain=true;const r=await handler(req(body));assert.equal(r.status,200);const output=await r.json();assert.equal(output.items[0].marks,null);assert.equal(output.approved,undefined);
}));
