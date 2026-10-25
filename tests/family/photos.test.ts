import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {avatar} from '../../platform/family/photos';
import {familyPhotoHandler} from '../../platform/family/photoHttp';
const child='123e4567-e89b-42d3-a456-426614174000';
test('profile avatars reject documents, oversized and tiny images and strip metadata',async()=>{
 await assert.rejects(avatar(Buffer.from('<svg></svg>')),/INVALID_PHOTO/);
 await assert.rejects(avatar(Buffer.alloc(2097153)),/INVALID_PHOTO/);
 await assert.rejects(avatar(await sharp({create:{width:10,height:10,channels:3,background:'red'}}).png().toBuffer()),/INVALID_PHOTO/);
 const input=await sharp({create:{width:900,height:700,channels:3,background:'blue'}}).withMetadata().png().toBuffer();
 const result=await avatar(input);const meta=await sharp(result).metadata();assert.equal(meta.width,256);assert.equal(meta.height,256);assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.ok(result.length<=102400);
});
test('photo endpoint guards identity, same origin, bounded bytes and stale revisions',async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL='https://school.example';let changes=0;let session=true;
 const handler=familyPhotoHandler({session:async()=>session?{personId:'owner'}:null,read:async(o,c)=>{assert.equal(o,'owner');assert.equal(c,child);return Buffer.from('jpeg');},change:async(o,c,v,b)=>{assert.equal(o,'owner');assert.equal(c,child);assert.equal(v,2);assert.ok(b);changes++;return {revision:3};}});
 const request=(method='GET',body?:Buffer,origin='https://school.example',auth=true)=>new Request(`https://school.example/api/v1/family/photo?child=${child}`,{method,headers:{origin,'x-draft-revision':'2',...auth?{authorization:'Bearer test'}:{}},body:body?new Uint8Array(body):undefined});
 try{assert.equal((await handler(request('GET',undefined,undefined,false))).status,401);session=false;assert.equal((await handler(request())).status,401);session=true;assert.equal((await handler(request('PUT',Buffer.from('x'),'https://evil.example'))).status,403);assert.equal((await handler(request('PUT',Buffer.alloc(2097153)))).status,413);assert.equal(changes,0);
 const bytes=await sharp({create:{width:200,height:200,channels:3,background:'red'}}).png().toBuffer();assert.equal((await handler(request('PUT',bytes))).status,200);assert.equal(changes,1);const read=await handler(request());assert.equal(read.headers.get('cache-control'),'private, no-store');assert.equal(read.headers.get('content-type'),'image/jpeg');
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
