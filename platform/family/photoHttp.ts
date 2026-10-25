import {z} from 'zod';
import {FamilyDraftError} from '../../domains/family/contracts';
import {sameOrigin} from '../admin/peosProxy';
import {resolvePeosAuthorization} from '../session/peosAuthorization';
import {PeosSessionResolver} from '../session/peosSessionResolver';
import {readServerEnvironment} from '../config/env';
import {getDatabasePool} from '../db/pool';
import {avatar,changeAvatar,readAvatar} from './photos';
type Deps={session:(r:Request)=>Promise<{personId:string}|null>;read:(owner:string,child:string)=>Promise<Buffer>;change:(owner:string,child:string,revision:number,bytes:Buffer|null)=>Promise<unknown>};
export function familyPhotoHandler(deps:Deps){return async(r:Request)=>{
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};const reply=(error:string,status:number)=>Response.json({error},{status,headers});
 try{
 if(!['GET','PUT','DELETE'].includes(r.method))return reply('METHOD_NOT_ALLOWED',405);
 if(r.method!=='GET'&&!sameOrigin(r))return reply('FORBIDDEN',403);
 if(!resolvePeosAuthorization(r))return reply('UNAUTHENTICATED',401);const session=await deps.session(r);if(!session)return reply('UNAUTHENTICATED',401);
 const params=new URL(r.url).searchParams;if([...params.keys()].some(k=>k!=='child'))return reply('INVALID_INPUT',400);
 const child=z.string().uuid().parse(params.get('child'));
 if(r.method==='GET')return new Response(new Uint8Array(await deps.read(session.personId,child)),{headers:{...headers,'content-type':'image/jpeg','content-disposition':'inline'}});
 const revision=z.coerce.number().int().positive().max(2147483646).parse(r.headers.get('x-draft-revision'));
 let bytes:Buffer|null=null;
 if(r.method==='PUT'){
 const reader=r.body?.getReader();if(!reader)return reply('INVALID_PHOTO',400);const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2097152){await reader.cancel();return reply('PHOTO_TOO_LARGE',413);}chunks.push(part.value);}}finally{reader.releaseLock();}
 bytes=await avatar(Buffer.concat(chunks));
 }
 return Response.json(await deps.change(session.personId,child,revision,bytes),{headers});
 }catch(e){if(e instanceof FamilyDraftError)return reply(e.code,e.status);if(e instanceof z.ZodError)return reply('INVALID_INPUT',400);return reply('PHOTO_UNAVAILABLE',503);}
 };}
export async function familyPhotoRequest(r:Request){const env=readServerEnvironment();if(!env.PEOS_BASE_URL||env.SPACECASE_WORKSPACE_MODE!=='operational')return Response.json({error:'PHOTO_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store'}});return familyPhotoHandler({session:r=>new PeosSessionResolver(env.PEOS_BASE_URL!).resolve(r),read:(o,c)=>readAvatar(getDatabasePool(),o,c),change:(o,c,v,b)=>changeAvatar(getDatabasePool(),o,c,v,b)})(r);}
