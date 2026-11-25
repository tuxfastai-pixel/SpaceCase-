import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {loginBranding} from '../../platform/appearance/loginBranding';
test('school login branding ignores malformed hints and shows only the requested public projection',async()=>{
 const id=randomUUID();let calls=0;
 const pool={query:async(sql:string,values:unknown[])=>{calls++;assert.deepEqual(values,[id]);assert.match(sql,/school_login_branding/);assert.doesNotMatch(sql,/family_intake|school_comms|school_finance/);return {rows:[{display_name:'Example school',jpeg:Buffer.from([255,216,255])}]};}} as unknown as Pool;
 assert.equal(await loginBranding('https://wrong.example',pool),null);assert.equal(calls,0);
 const brand=await loginBranding(id,pool);assert.equal(brand?.name,'Example school');assert.match(brand!.logo!,/^data:image\/jpeg;base64,/);
 assert.equal(await loginBranding(id,{query:async()=>({rows:[]})} as unknown as Pool),null);
 assert.equal(await loginBranding(id,{query:async()=>{throw Error('offline');}} as unknown as Pool),null);
});
