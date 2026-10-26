import {NextResponse} from 'next/server';
import {DELETE as revokeSession} from '../../api/v1/auth/session/route';
import {authConfiguration,createAuthClient} from '../../../platform/auth/supabase';
import {beginGoogleSignIn} from '../../../platform/auth/beginGoogleSignIn';
import {onboardingPath,onboardingCookie} from '../../../platform/auth/onboardingPath';
import {boundedText} from '../../../platform/http/boundedText';
export async function POST(request:Request){
 const config=authConfiguration();
 if(request.headers.get('origin')!==config.origin)return new Response('Forbidden',{status:403});
 let path;try{const form=new URLSearchParams(await boundedText(request,512));if(form.getAll('onboarding').length>1)return new Response('Invalid starting path',{status:400});path=onboardingPath(form.get('onboarding')??'existing');if(!path)return new Response('Invalid starting path',{status:400});}catch{return new Response('Invalid starting path',{status:400});}
 const plan=await beginGoogleSignIn({origin:config.origin,providerOrigin:new URL(config.url).origin},()=>revokeSession(request),async()=>{
  const client=await createAuthClient();return client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${config.origin}/auth/callback`,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
 });
 const response=NextResponse.redirect(plan.destination,303);response.headers.append('set-cookie',plan.cookie);response.headers.append('set-cookie',onboardingCookie(path,process.env.NODE_ENV==='production',new URL(plan.destination).origin!==new URL(config.url).origin));response.headers.set('cache-control','no-store');return response;
}
