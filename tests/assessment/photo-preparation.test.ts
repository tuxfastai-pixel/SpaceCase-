import test from 'node:test';
import assert from 'node:assert/strict';
import {fullPhoto,photoGeometry} from '../../app/assessments/photoPreparation';
test('crop uses original image coordinates and rotation swaps output dimensions without upscaling',()=>{
 const crop=photoGeometry(1000,1600,{...fullPhoto,left:10,right:20,top:5,bottom:10,turns:1});
 assert.deepEqual(crop,{x:100,y:80,w:700,h:1360,width:1360,height:700,ratio:1,turns:1});
 assert.equal(photoGeometry(4000,6000).width,1600);assert.equal(photoGeometry(4000,6000).height,2400);
 for(const turns of [0,1,2,3]){const g=photoGeometry(4000,6000,{...fullPhoto,turns});assert.ok(g.width<=1800&&g.height<=2400);assert.ok(g.ratio<=1);}
});
test('unsafe sizes, invalid crops and unreadably small cropped pages fail before drawing',()=>{
 for(const [w,h] of [[99,200],[6000,6000],[NaN,100],[100.5,100]])assert.throws(()=>photoGeometry(w,h));
 for(const edits of [{left:-1},{right:41},{top:NaN},{bottom:Infinity},{turns:1.5},{turns:4}])assert.throws(()=>photoGeometry(1200,1600,{...fullPhoto,...edits}));
 assert.throws(()=>photoGeometry(100,200,{...fullPhoto,left:40,right:40}),/too small/);
});

test('photo preparation validates before decoding, releases bitmaps and canvas, and returns bounded JPEG bytes',async()=>{
 const {preparePhoto,drawPhoto}=await import('../../app/assessments/photoPreparation');
 const originalBitmap=globalThis.createImageBitmap,originalDocument=globalThis.document;let decoded=0,closed=0;
 const draws:unknown[][]=[];let size=100;
 const canvas={width:0,height:0,getContext:()=>({fillStyle:'',fillRect:()=>{},translate:()=>{},rotate:()=>{},scale:()=>{},drawImage:(...args:unknown[])=>draws.push(args)}),toBlob:(done:(blob:Blob)=>void,type:string)=>{assert.equal(type,'image/jpeg');done(new Blob([new Uint8Array(size)],{type}));}};
 globalThis.document={createElement:()=>canvas} as unknown as Document;
 globalThis.createImageBitmap=(async()=>{decoded++;return {width:1200,height:1600,close:()=>{closed++;}};}) as typeof createImageBitmap;
 try{
  await assert.rejects(preparePhoto(new File(['x'],'page.heic',{type:'image/heic'})),/JPG/);assert.equal(decoded,0);
  const result=await preparePhoto(new File(['original metadata'],'page.png',{type:'image/png'}),{...fullPhoto,left:10,turns:1});
  assert.equal(result.type,'image/jpeg');assert.equal(result.name,'page.jpg');assert.equal(result.size,100);assert.equal(closed,1);assert.equal(canvas.width,0);assert.equal(canvas.height,0);
  assert.deepEqual(draws[0].slice(1,5),[120,0,1080,1600]);
  size=2097153;await assert.rejects(preparePhoto(new File(['x'],'large.png',{type:'image/png'})),/still too large/);assert.equal(canvas.width,0);assert.equal(closed,2);
  const broken={width:0,height:0,getContext:()=>null} as unknown as HTMLCanvasElement;await assert.rejects(drawPhoto(new Blob(),broken),/could not prepare/);assert.equal(closed,3);
 }finally{globalThis.createImageBitmap=originalBitmap;globalThis.document=originalDocument;}
});
