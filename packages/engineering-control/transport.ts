import {createPrivateKey,createPublicKey,sign,verify,type KeyObject} from 'node:crypto';
import {z} from 'zod';
import {prepareRunnerPlan,runnerRequestSchema,type PreflightContext} from './runner-policy';

export const saveTaskInputSchema=z.object({requestId:z.string().uuid(),request:runnerRequestSchema}).strict();
const claimsSchema=saveTaskInputSchema.extend({
 version:z.literal('psg.engineering-save.v1'),issuer:z.literal('SPACECASE'),audience:z.literal('PSG_ENGINEERING_LEDGER'),
 purpose:z.literal('SAVE_BLOCKED_TASK'),actorPersonId:z.string().uuid(),issuedAt:z.number().int().nonnegative(),expiresAt:z.number().int().nonnegative(),
}).strict();
export {savedTaskSchema} from './result';
export class AttestationError extends Error{}
export function engineeringSigningKey(pem:string){const key=createPrivateKey(pem);if(key.asymmetricKeyType!=='ed25519')throw new AttestationError('ED25519_KEY_REQUIRED');return key;}
export function engineeringVerificationKey(pem:string){if(!pem.trim().startsWith('-----BEGIN PUBLIC KEY-----'))throw new AttestationError('PUBLIC_KEY_REQUIRED');const key=createPublicKey(pem);if(key.asymmetricKeyType!=='ed25519')throw new AttestationError('ED25519_KEY_REQUIRED');return key;}
export function signTaskSave(input:z.infer<typeof saveTaskInputSchema>,authority:PreflightContext & {personId:string},key:KeyObject,now=Math.floor(Date.now()/1000)){
 const parsed=saveTaskInputSchema.parse(input);prepareRunnerPlan(parsed.request,authority);
 const claims=claimsSchema.parse({...parsed,version:'psg.engineering-save.v1',issuer:'SPACECASE',audience:'PSG_ENGINEERING_LEDGER',purpose:'SAVE_BLOCKED_TASK',actorPersonId:authority.personId,issuedAt:now,expiresAt:now+30});
 const payload=Buffer.from(JSON.stringify(claims));if(payload.length>65536)throw new AttestationError('ATTESTATION_TOO_LARGE');
 if(key.type!=='private'||key.asymmetricKeyType!=='ed25519')throw new AttestationError('ED25519_KEY_REQUIRED');
 return `${payload.toString('base64url')}.${sign(null,payload,key).toString('base64url')}`;
}
export function verifyTaskSave(token:string,key:KeyObject,now=Math.floor(Date.now()/1000)){
 if(token.length>87500||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw new AttestationError('INVALID_ATTESTATION');
 const [encoded,signature]=token.split('.'),payload=Buffer.from(encoded,'base64url'),signatureBytes=Buffer.from(signature,'base64url');
 if(payload.length>65536||signatureBytes.length!==64||key.type!=='public'||key.asymmetricKeyType!=='ed25519'||!verify(null,payload,key,signatureBytes))throw new AttestationError('INVALID_ATTESTATION');
 const claims=claimsSchema.parse(JSON.parse(payload.toString('utf8')));
 if(claims.issuedAt>now+5||claims.expiresAt!==claims.issuedAt+30||claims.expiresAt<=now)throw new AttestationError('EXPIRED_ATTESTATION');
 // The issuer attests to authority/source at issuance. This permits blocked storage only.
 prepareRunnerPlan(claims.request,{founder:true,sourceRevision:claims.request.handoff.source.revision,sourceOpen:true});
 return claims;
}

export async function boundedEngineeringText(input:{body:ReadableStream<Uint8Array>|null},max:number){
 if(!input.body)throw new AttestationError('INVALID_INPUT');const reader=input.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new AttestationError('INPUT_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
