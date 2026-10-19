import assert from "node:assert/strict";
import test from "node:test";
import type {Pool} from "pg";
import {storageReady,workspaceSchema} from "../../domains/workspace/service";
test("workspace settings accept a real timezone without accepting submitted school or class scope",()=>{
 assert.equal(workspaceSchema.safeParse({timezone:"Africa/Johannesburg",academicYearLabel:"2026"}).success,true);
 assert.equal(workspaceSchema.safeParse({timezone:"Not/AZone",academicYearLabel:"2026"}).success,false);
 assert.equal(workspaceSchema.safeParse({timezone:"UTC",academicYearLabel:"2026",classIds:["guessed"]}).success,false);
});
test("storage readiness fails closed on missing schema and checks runtime access",async()=>{
 const statements:string[]=[];
 const missing={query:async(sql:string)=>{statements.push(sql);return {rows:[{ready:false}]};}} as unknown as Pool;
 await assert.rejects(storageReady(missing),/STORAGE_SCHEMA_REQUIRED/);
 assert.ok(statements[0].includes("to_regclass('identity.persons') IS NULL"));
 assert.equal(statements.length,1);
 const noAccess={query:async()=>{throw new Error("permission denied");}} as unknown as Pool;
 await assert.rejects(storageReady(noAccess),/permission denied/);
});
