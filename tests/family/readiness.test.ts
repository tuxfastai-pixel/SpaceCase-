import test from 'node:test';import assert from 'node:assert/strict';
import {emptyFamily} from '../../domains/family/contracts';import {familyReadiness} from '../../domains/family/readiness';
test('family readiness points to missing essentials without requiring a second adult, address or reference',()=>{
 const p=emptyFamily();const initial=familyReadiness(p,[]);assert.equal(initial.issues.length,6);assert.deepEqual(new Set(initial.issues.map(i=>i.step)),new Set([0,1,2]));
 p.parent.givenName='Jordan';p.parent.familyName='Demo';p.parent.email='jordan@example.com';Object.assign(p.children[0],{givenName:'Amara',familyName:'Demo',dateOfBirth:'2019-10-25',schoolName:'Example school'});
 const complete=familyReadiness(p,[p.children[0].id]);assert.equal(complete.detailsComplete,true);assert.equal(complete.schoolConnectionVerified,false);assert.equal(complete.submissionAvailable,false);
 p.parent.email='';p.parent.phone='0123456789';assert.equal(familyReadiness(p,[p.children[0].id]).detailsComplete,true);
});
test('photos belong to each local child and completeness never becomes verification',()=>{
 const p=emptyFamily();p.children.push({...p.children[0],id:crypto.randomUUID()});const r=familyReadiness(p,[p.children[0].id,crypto.randomUUID()]);const missing=r.issues.filter(i=>i.code==='CHILD_PHOTO');assert.equal(missing.length,1);assert.equal(missing[0].childId,p.children[1].id);assert.equal(r.submissionAvailable,false);
});
