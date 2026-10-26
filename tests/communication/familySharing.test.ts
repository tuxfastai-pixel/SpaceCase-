import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFamilyInvitationMessage,invitationWebEmailDraft,invitationWhatsAppDraft} from '../../platform/invitations/message';
import {familyInvitationStatus} from '../../platform/invitations/familyStatus';
const input={origin:'https://school.example.test',token:'a'.repeat(43),expiresAt:'2026-11-01T12:00:00Z'};
test('family sharing keeps the bearer token in the invitation fragment and explains review, without learner PII',()=>{
 const m=prepareFamilyInvitationMessage(input),url=new URL(m.link);
 assert.equal(url.pathname,'/family/invitation');assert.equal(url.search,'');assert.equal(url.hash,`#token=${input.token}`);
 assert.match(m.text,/exact email/);assert.match(m.text,/school must review/);assert.match(m.text,/does not yet open learner records/);
 for(const origin of ['http://school.example.test','https://user:password@school.example.test','https://school.example.test/path'])assert.throws(()=>prepareFamilyInvitationMessage({...input,origin}));
 assert.throws(()=>prepareFamilyInvitationMessage({...input,token:'bad'}));
});
test('browser email and WhatsApp preserve the full private invitation and never send themselves',()=>{
 const message=prepareFamilyInvitationMessage(input);const email=new URL(invitationWebEmailDraft('Parent@example.test',message));
 assert.equal(email.origin,'https://mail.google.com');assert.equal(email.searchParams.get('to'),'parent@example.test');assert.equal(email.searchParams.get('body'),message.text);assert.equal(email.searchParams.get('su'),message.subject);
 const whatsapp=new URL(invitationWhatsAppDraft(message));assert.equal(whatsapp.origin,'https://wa.me');assert.equal(whatsapp.searchParams.get('text'),message.text);assert.equal(whatsapp.pathname,'/');
 assert.throws(()=>invitationWebEmailDraft('bad',message));assert.throws(()=>invitationWebEmailDraft('parent@example.test',{...message,subject:'Hello\r\nBcc: other@example.test'}));
});
test('accepted is green pending review; confirmed is blue; elapsed time and unknown states never confer confirmation',()=>{
 assert.equal(familyInvitationStatus('CLAIMED').tone,'accepted');assert.match(familyInvitationStatus('CLAIMED').label,/awaiting school review/);
 assert.equal(familyInvitationStatus('CONFIRMED').tone,'confirmed');
 for(const state of ['ISSUED','REVOKED','EXPIRED','DECLINED','WITHDRAWN','UNKNOWN'])assert.notEqual(familyInvitationStatus(state).tone,'confirmed');
});
