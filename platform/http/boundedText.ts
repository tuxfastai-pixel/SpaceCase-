export async function boundedText(request:Request,max:number){
 const reader=request.body?.getReader();if(!reader)return "";const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new RangeError("REQUEST_TOO_LARGE");}chunks.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString("utf8");
}
