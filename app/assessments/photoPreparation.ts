export type PhotoEdits={left:number;right:number;top:number;bottom:number;turns:number};
export const fullPhoto:PhotoEdits={left:0,right:0,top:0,bottom:0,turns:0};
export function photoGeometry(width:number,height:number,edits:PhotoEdits=fullPhoto){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<100||height<100||width*height>24000000)throw Error('Use a clear photo between 100 pixels and 24 megapixels.');
 const {left,right,top,bottom,turns}=edits;
 if(![left,right,top,bottom].every(v=>Number.isFinite(v)&&v>=0&&v<=40)||!Number.isInteger(turns)||turns<0||turns>3)throw Error('Check the crop and rotation.');
 const x=Math.round(width*left/100),y=Math.round(height*top/100),w=width-x-Math.round(width*right/100),h=height-y-Math.round(height*bottom/100);
 if(Math.min(w,h)<100)throw Error('The cropped page is too small. Keep more of the original photo.');
 const rotated=turns%2===1,outWidth=rotated?h:w,outHeight=rotated?w:h,ratio=Math.min(1,1800/outWidth,2400/outHeight);
 return {x,y,w,h,width:Math.round(outWidth*ratio),height:Math.round(outHeight*ratio),ratio,turns};
}
export async function drawPhoto(file:Blob,canvas:HTMLCanvasElement,edits:PhotoEdits=fullPhoto){
 const bitmap=await createImageBitmap(file);
 try{
  const g=photoGeometry(bitmap.width,bitmap.height,edits);canvas.width=g.width;canvas.height=g.height;
  const context=canvas.getContext('2d');if(!context)throw Error('Your browser could not prepare this image.');
  context.fillStyle='white';context.fillRect(0,0,g.width,g.height);context.translate(g.width/2,g.height/2);context.rotate(g.turns*Math.PI/2);context.scale(g.ratio,g.ratio);context.drawImage(bitmap,g.x,g.y,g.w,g.h,-g.w/2,-g.h/2,g.w,g.h);
 }finally{bitmap.close();}
}
export async function preparePhoto(file:File,edits:PhotoEdits=fullPhoto){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000)throw Error('Choose JPG, PNG or WebP photos below 20 MB. If your camera produces HEIC, choose a JPG version from your photo library.');
 const canvas=document.createElement('canvas');
 try{
  await drawPhoto(file,canvas,edits);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(Error('Photo conversion failed.')),'image/jpeg',.85));
  if(blob.size>2097152)throw Error('This photo is still too large after preparation. Use a smaller photo.');
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
 }finally{canvas.width=0;canvas.height=0;}
}
