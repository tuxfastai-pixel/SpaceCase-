import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {assessmentInput,actionSchema,proposalSchema,validateProposal,validateScores} from "../../domains/assessment/contracts";
const q={id:randomUUID(),label:"1",prompt:"Add 1 + 1",expectedAnswer:"2",maxMarks:2};
test("assessment rubrics reject duplicate questions, unknown fields and excessive totals",()=>{
 const base={id:randomUUID(),title:"Maths",subject:"Maths",instructions:"",rubric:[q]};assert.equal(assessmentInput.safeParse(base).success,true);
 for(const v of [{...base,learnerNames:[]},{...base,rubric:[]},{...base,rubric:[q,q]},{...base,rubric:[{...q,maxMarks:0}]},{...base,rubric:[q,{...q,id:randomUUID(),label:"2",maxMarks:1000}]}])assert.equal(assessmentInput.safeParse(v).success,false);
});
test("only explicit complete teacher review can be approved; marks remain bounded",()=>{
 const scores=[{questionId:q.id,marks:1,feedback:"Check your sum",reviewed:true as const}];assert.equal(validateScores([q],scores),1);
 assert.throws(()=>validateScores([q],[{...scores[0],marks:3}]),/INVALID_SCORES/);assert.throws(()=>validateScores([q],[]),/INVALID_SCORES/);
 assert.equal(actionSchema.safeParse({action:"SAVE_REVIEW",submissionId:randomUUID(),revision:1,scores:[{...scores[0],reviewed:false}]}).success,false);
 assert.equal(actionSchema.safeParse({action:"APPROVE",submissionId:randomUUID(),revision:1,acknowledged:false}).success,false);
 assert.equal(actionSchema.safeParse({action:"APPROVE",submissionId:randomUUID(),revision:1,acknowledged:true,scores}).success,false);
});
test("assistant proposals must refer to actual questions and pages; uncertainty can abstain",()=>{
 const page=randomUUID();const p=proposalSchema.parse({executionId:"test-run",modelRef:"test-model",policyVersion:"test-v1",items:[{questionId:q.id,marks:1,uncertain:false,feedback:"Draft",evidencePageIds:[page]}],warnings:[]});
 assert.equal(validateProposal([q],[page],p),p);
 for(const item of [{...p.items[0],marks:3},{...p.items[0],questionId:randomUUID()},{...p.items[0],evidencePageIds:[randomUUID()]},{...p.items[0],marks:null},{...p.items[0],evidencePageIds:[]}])assert.throws(()=>validateProposal([q],[page],{...p,items:[item]}),/INVALID_AI_RESPONSE/);
 assert.doesNotThrow(()=>validateProposal([q],[page],{...p,items:[{...p.items[0],marks:null,uncertain:true,evidencePageIds:[]}]}));
});
