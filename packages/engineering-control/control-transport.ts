import {sign,verify,type KeyObject} from 'node:crypto';
import {z} from 'zod';
import {controlInputSchema,type EngineeringControlInput} from './control-contract';
const claimsSchema=z.object({version:z.literal('psg.engineering-control.v1'),issuer:z.literal('SPACECASE'),audience:z.literal('PSG_ENGINEERING_LEDGER'),actorPersonId:z.string().uuid(),issuedAt:z.number().int().nonnegative(),expiresAt:z.number().int().nonnegative(),input:controlInputSchema}).strict();
export function signTaskControl(input:EngineeringControlInput,authority:{founder:boolean;personId:string},key:KeyObject,now=Math.floor(Date.now()/1000)){
 if(!authority.founder)throw Error('FOUNDER_REQUIRED');
 if(key.type!=='private'||key.asymmetricKeyType!=='ed25519')throw Error('INVALID_SIGNING_KEY');
 const claims=claimsSchema.parse({version:'psg.engineering-control.v1',issuer:'SPACECASE',audience:'PSG_ENGINEERING_LEDGER',actorPersonId:authority.personId,issuedAt:now,expiresAt:now+30,input});
 const payload=Buffer.from(JSON.stringify(claims));return `${payload.toString('base64url')}.${sign(null,payload,key).toString('base64url')}`;
}
export function verifyTaskControl(token:string,key:KeyObject,now=Math.floor(Date.now()/1000)){
 if(token.length>4096||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||key.type!=='public'||key.asymmetricKeyType!=='ed25519')throw Error('INVALID_ATTESTATION');
 const [body,signature]=token.split('.'),payload=Buffer.from(body,'base64url'),sig=Buffer.from(signature,'base64url');
 if(sig.length!==64||!verify(null,payload,key,sig))throw Error('INVALID_ATTESTATION');
 const claims=claimsSchema.parse(JSON.parse(payload.toString('utf8')));
 if(claims.issuedAt>now+5||claims.expiresAt!==claims.issuedAt+30||claims.expiresAt<=now)throw Error('EXPIRED_ATTESTATION');
 return claims;
}
