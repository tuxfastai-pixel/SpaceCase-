import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {schoolContextSchema,orderedClasses} from "../../app/dashboard/workspaceModel";
test("workspace rejects malformed class authority and finds assigned classes without mutating the source",()=>{
 const schoolId=randomUUID(),classId=randomUUID();const value={teacherPersonId:randomUUID(),schoolId,roleIds:[],schoolWorkspace:{configured:true,settings:{}},classes:[{classId,name:"Grade 10",workspaceConfigured:true,localSettings:{}},{classId:randomUUID(),name:"Grade 2",workspaceConfigured:false,localSettings:{}}]};
 assert.equal(schoolContextSchema.safeParse(value).success,true);assert.equal(schoolContextSchema.safeParse({...value,classes:[{...value.classes[0],classId:"../../admin"}]}).success,false);
 assert.deepEqual(orderedClasses(value.classes).map(c=>c.name),["Grade 2","Grade 10"]);assert.equal(value.classes[0].classId,classId);assert.equal(orderedClasses(value.classes,"  GRADE 2 ")[0].workspaceConfigured,false);assert.equal(orderedClasses(value.classes,"missing").length,0);
});
