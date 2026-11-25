import {noticeReturn} from './noticeReturn';
export const ONBOARDING_PATH_COOKIE='spacecase_onboarding_path';
export type OnboardingPath='existing'|'parent'|'teacher'|'school';
export function onboardingPath(value:unknown):OnboardingPath|null{return value==='existing'||value==='parent'||value==='teacher'||value==='school'?value:null;}
export function signInDestination(input:{familyInvitation:boolean;staffInvitation:boolean;path:unknown;returnTo?:unknown}){
 if(input.familyInvitation)return '/family/invitation';
 if(input.staffInvitation)return '/join';
 const target=noticeReturn(input.returnTo);if(target)return target;
 switch(onboardingPath(input.path)){case 'parent':return '/parent';case 'teacher':return '/teacher';case 'school':return '/onboarding?path=school';default:return '/dashboard';}
}
export function onboardingCookie(path:OnboardingPath,secure:boolean,clear=false){return `${ONBOARDING_PATH_COOKIE}=${clear?'':path}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:600}${secure?'; Secure':''}`;}
