import test from "node:test";
import assert from "node:assert/strict";
import { workspaceDestination } from "../../platform/auth/workspaceDestination";

test("founder lands in control centre even with school administration access", async () => {
  assert.equal(await workspaceDestination(async () => ({founder:true}), async () => {throw new Error("admin lookup must not override founder");}), "/founder");
});
test("school admins and teachers keep their existing workspace destinations", async () => {
  assert.equal(await workspaceDestination(async () => ({founder:false}), async () => [{}]), "/admin");
  assert.equal(await workspaceDestination(async () => ({founder:false}), async () => []), null);
});
test("an unavailable authority never infers founder access", async () => {
  await assert.rejects(workspaceDestination(async () => {throw new Error("unavailable");}, async () => [{}]), /unavailable/);
});

test('principal lands in school overview and founder remains the highest-priority home',async()=>{
 assert.equal(await workspaceDestination(async()=>({founder:false}),async()=>[{principal:true}]),'/principal');
 assert.equal(await workspaceDestination(async()=>({founder:true}),async()=>[{principal:true}]),'/founder');
 await assert.rejects(workspaceDestination(async()=>({founder:false}),async()=>{throw Error('lookup failed');}),/lookup failed/);
});
