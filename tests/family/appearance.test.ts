import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {normalizeLogo,chooseAccountPhoto,accountPhoto} from '../../platform/appearance/service';
import {parentHomeState} from '../../platform/family/home';
import {emptyFamily} from '../../domains/family/contracts';
import {writeFamilyDraft,clearFamilyDraft} from '../../domains/family/service';
import {changeAvatar} from '../../platform/family/photos';
test('logo processing bounds raster inputs, preserves aspect ratio and strips metadata',async()=>{
 const input=await sharp({create:{width:700,height:350,channels:3,background:'#245b48'}}).png().withMetadata().toBuffer(),out=await normalizeLogo(input),m=await sharp(out).metadata();assert.equal(m.format,'jpeg');assert.equal(m.width,512);assert.equal(m.height,256);assert.equal(m.exif,undefined);await assert.rejects(normalizeLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')));await assert.rejects(normalizeLogo(Buffer.alloc(2097153)));await assert.rejects(normalizeLogo(await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer()));
});
test('account avatars isolate owners and school learners, follow replacements and disappear with the private draft',{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),owner=randomUUID(),other=randomUUID(),school=randomUUID(),learner=randomUUID(),profile=emptyFamily(),child=profile.children[0].id,photo=await sharp({create:{width:256,height:256,channels:3,background:'#245b48'}}).jpeg().toBuffer();
 try{await writeFamilyDraft(pool,owner,{revision:0,profile});await changeAvatar(pool,owner,child,1,photo);await chooseAccountPhoto(pool,owner,school,learner,child);assert.deepEqual(await accountPhoto(pool,owner,school,learner),photo);await assert.rejects(chooseAccountPhoto(pool,other,school,learner,child),/PHOTO_NOT_FOUND/);await assert.rejects(accountPhoto(pool,other,school,learner),/PHOTO_NOT_FOUND/);await assert.rejects(accountPhoto(pool,owner,randomUUID(),learner),/PHOTO_NOT_FOUND/);await assert.rejects(accountPhoto(pool,owner,school,randomUUID()),/PHOTO_NOT_FOUND/);const replacement=await sharp({create:{width:256,height:256,channels:3,background:'white'}}).jpeg().toBuffer();await changeAvatar(pool,owner,child,2,replacement);assert.deepEqual(await accountPhoto(pool,owner,school,learner),replacement);await clearFamilyDraft(pool,owner,3);await assert.rejects(accountPhoto(pool,owner,school,learner),/PHOTO_NOT_FOUND/);assert.equal((await pool.query('SELECT count(*) FROM family_intake.account_photos WHERE owner_person_id=$1',[owner])).rows[0].count,'0');
 }finally{await pool.query('DELETE FROM family_intake.child_photos WHERE owner_person_id=$1',[owner]);await pool.query('DELETE FROM family_intake.draft_events WHERE owner_person_id=$1',[owner]);await pool.query('DELETE FROM family_intake.drafts WHERE owner_person_id=$1',[owner]);await pool.end();}
});

test('media routes require current authority before storage and never allow parent or Finance logo writes',async()=>{
 const {appearanceHandler}=await import('../../platform/appearance/http');const {accountKeyInput}=await import('../../platform/family/accountNavigation');const {createHash}=await import('node:crypto');const id=randomUUID(),school=randomUUID(),owner=randomUUID(),key=createHash('sha256').update(accountKeyInput(id)).digest('hex');let storage=0;
 const directory={contractVersion:'family-billing-v1' as const,scopes:[{grantId:id,schoolId:school,learnerPersonId:randomUUID(),schoolName:'Example school',learnerReference:'DEMO-1',givenName:'Example',familyName:'Learner',actions:['family.finance.read' as const],expiresAt:'2099-01-01T00:00:00Z'}],truncated:false};
 const deps={session:async()=>({personId:owner}),origin:()=>true,operational:()=>true,enabled:()=>true,directory:async()=>directory,authorize:async()=>({allowed:true as const,contractVersion:'family-billing-v1' as const,grantId:id,personId:owner,schoolId:school,learnerPersonId:directory.scopes[0].learnerPersonId,action:'family.finance.read' as const,expiresAt:'2099-01-01T00:00:00Z'}),pool:()=>{storage++;throw Error('must not access storage');},admin:async()=>[]};
 const home=parentHomeState({connections:null,directory,plansEnabled:false,incomplete:false});assert.match(home.learners[0].schoolKey,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(home).includes(school),false);
 const request=(query:string,method='GET')=>new Request(`https://school.example/api/v1/appearance?${query}`,{method,headers:{authorization:'Bearer synthetic-test-session'}});
 assert.equal((await appearanceHandler({...deps,session:async()=>null})(request(`kind=photo&account=${key}`))).status,401);
 assert.equal((await appearanceHandler({...deps,directory:async()=>({...directory,scopes:[]})})(request(`kind=photo&account=${key}`))).status,403);
 assert.equal((await appearanceHandler(deps)(request(`kind=photo&account=${key}&school=${randomUUID()}`))).status,403);
 assert.equal((await appearanceHandler(deps)(request(`kind=logo&account=${key}`,'PUT'))).status,403);
 assert.equal((await appearanceHandler(deps)(request(`kind=logo&school=${school}&view=finance`,'PUT'))).status,403);
 assert.equal((await appearanceHandler(deps)(request(`kind=logo&school=${school}&view=admin`,'PUT'))).status,403);
 assert.equal((await appearanceHandler({...deps,origin:()=>false})(request(`kind=logo&school=${school}&view=admin`,'PUT'))).status,403);assert.equal(storage,0);
});

test('authorised logo reads are private and only current administrators can save normalized school branding',async()=>{
 const {appearanceHandler}=await import('../../platform/appearance/http');const owner=randomUUID(),school=randomUUID(),writes:unknown[][]=[],jpeg=await sharp({create:{width:200,height:100,channels:3,background:'#245b48'}}).jpeg().toBuffer();
 const pool={query:async(sql:string,values:unknown[])=>{if(sql.startsWith('INSERT INTO presentation.school_logos'))writes.push(values);return {rows:sql.startsWith('SELECT')?[{jpeg}]:[],rowCount:1};}} as unknown as Pool;
 const handler=appearanceHandler({session:async()=>({personId:owner}),origin:()=>true,operational:()=>true,admin:async()=>[{id:school,displayName:'Example school',principal:false}],pool:()=>pool});
 const url=`https://school.example/api/v1/appearance?kind=logo&school=${school}&view=admin`,r=await handler(new Request(url,{headers:{authorization:'Bearer synthetic-test-session'}}));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await r.arrayBuffer()),jpeg);const saved=await handler(new Request(url,{method:'PUT',headers:{authorization:'Bearer synthetic-test-session','content-type':'image/jpeg'},body:new Uint8Array(jpeg)}));assert.equal(saved.status,200);assert.equal(writes[0][0],school);assert.equal(writes[0][2],owner);assert.equal((await sharp(writes[0][1] as Buffer).metadata()).exif,undefined);
});
