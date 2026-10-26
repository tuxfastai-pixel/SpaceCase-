import {NextResponse} from 'next/server';
import {DELETE as revokeSession} from '../../api/v1/auth/session/route';
import {authConfiguration,createAuthClient} from '../../../platform/auth/supabase';
import {beginGoogleSignIn} from '../../../platform/auth/beginGoogleSignIn';
export async function POST(request:Request){
 const config=authConfiguration();
 if(request.headers.get('origin')!==config.origin)return new Response('Forbidden',{status:403});
 const plan=await beginGoogleSignIn({origin:config.origin,providerOrigin:new URL(config.url).origin},()=>revokeSession(request),async()=>{
  const client=await createAuthClient();return client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${config.origin}/auth/callback`,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
 });
 const response=NextResponse.redirect(plan.destination,303);response.headers.append('set-cookie',plan.cookie);response.headers.set('cache-control','no-store');return response;
}
