import test from 'node:test';import assert from 'node:assert/strict';
import {onboardingPath,onboardingCookie,signInDestination} from '../../platform/auth/onboardingPath';
test('entry choices select fixed non-privileged paths and never arbitrary roles or redirects',()=>{
 assert.equal(signInDestination({familyInvitation:false,staffInvitation:false,path:'parent'}),'/parent');
 assert.equal(signInDestination({familyInvitation:false,staffInvitation:false,path:'school'}),'/onboarding?path=school');
 for(const value of ['FOUNDER','PRINCIPAL','https://evil.example','/admin',undefined]){assert.equal(onboardingPath(value),null);assert.equal(signInDestination({familyInvitation:false,staffInvitation:false,path:value}),'/dashboard');}
});
test('pending invitations retain priority over a starting preference',()=>{
 assert.equal(signInDestination({familyInvitation:true,staffInvitation:true,path:'parent'}),'/family/invitation');assert.equal(signInDestination({familyInvitation:false,staffInvitation:true,path:'parent'}),'/join');
});
test('onboarding intent is short-lived HttpOnly routing data and has a deterministic clear',()=>{
 const value=onboardingCookie('parent',true);for(const flag of ['HttpOnly','SameSite=Lax','Secure','Max-Age=600'])assert.ok(value.includes(flag));assert.match(onboardingCookie('parent',true,true),/spacecase_onboarding_path=;.*Max-Age=0/);
});
