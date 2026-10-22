import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createHandoff} from '../../packages/engineering-control/contracts';
import {engineeringSigningKey,engineeringVerificationKey,signTaskSave,verifyTaskSave} from '../../packages/engineering-control/transport';
const pair=generateKeyPairSync('ed25519');
const handoff=createHandoff({reference:'SC-ABCDEF012345',revision:2,category:'BUG',area:'OTHER'},{problem:'Synthetic report input does not advance.',expected:'Move to the next date segment.',observed:'Focus stays in the year.',steps:['Enter four year digits.'],acceptance:['Focus moves to month.']});
const input={requestId:randomUUID(),request:{handoff,digest:createHash('sha256').update(JSON.stringify(handoff)).digest('hex'),baseCommit:'a'.repeat(40)}};
const authority={personId:randomUUID(),founder:true,sourceRevision:2,sourceOpen:true};
function signedRaw(claims:unknown){const payload=Buffer.from(JSON.stringify(claims));return `${payload.toString('base64url')}.${sign(null,payload,pair.privateKey).toString('base64url')}`;}
test('engineering save attestations bind actor, exact work, purpose and a thirty-second window',()=>{
 const token=signTaskSave(input,authority,pair.privateKey,1000),claims=verifyTaskSave(token,pair.publicKey,1029);
 assert.equal(claims.actorPersonId,authority.personId);assert.deepEqual(claims.request,input.request);assert.equal(claims.purpose,'SAVE_BLOCKED_TASK');assert.equal(claims.expiresAt,1030);
 assert.throws(()=>verifyTaskSave(token,pair.publicKey,1030),/EXPIRED_ATTESTATION/);assert.throws(()=>verifyTaskSave(token,pair.publicKey,994),/EXPIRED_ATTESTATION/);
 assert.throws(()=>verifyTaskSave(token,generateKeyPairSync('ed25519').publicKey,1000));
 const [payload,sig]=token.split('.');assert.throws(()=>verifyTaskSave(`${payload.slice(0,-1)}A.${sig}`,pair.publicKey,1000));
 for(const value of [{...claims,purpose:'EXECUTE'},{...claims,audience:'OTHER'},{...claims,expiresAt:2000},{...claims,founder:true},{...claims,request:{...claims.request,baseCommit:'main'}}])assert.throws(()=>verifyTaskSave(signedRaw(value),pair.publicKey,1000));
 assert.throws(()=>verifyTaskSave('x'.repeat(90000),pair.publicKey,1000));
 for(const c of [{...authority,founder:false},{...authority,sourceRevision:3},{...authority,sourceOpen:false}])assert.throws(()=>signTaskSave(input,c,pair.privateKey,1000));
});
test('configuration requires Ed25519 private signing and public verification keys',()=>{
 assert.equal(engineeringSigningKey(pair.privateKey.export({format:'pem',type:'pkcs8'}).toString()).asymmetricKeyType,'ed25519');
 assert.equal(engineeringVerificationKey(pair.publicKey.export({format:'pem',type:'spki'}).toString()).type,'public');
 assert.throws(()=>engineeringVerificationKey(pair.privateKey.export({format:'pem',type:'pkcs8'}).toString()),/PUBLIC_KEY_REQUIRED/);
 const ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'});assert.throws(()=>engineeringVerificationKey(ec.publicKey.export({format:'pem',type:'spki'}).toString()),/ED25519_KEY_REQUIRED/);
});
