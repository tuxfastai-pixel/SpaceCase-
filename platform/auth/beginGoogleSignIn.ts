/** The previous PEOS cookie must be cleared on successful and failed account-switch starts.
 * This helper knows no email addresses and grants no role. */
export async function beginGoogleSignIn(
 configuration:{origin:string;providerOrigin:string},
 clearSession:()=>Promise<Response>,
 startOAuth:()=>Promise<{data:{url:string|null};error:unknown}>,
){
 const cookie=(await clearSession()).headers.get('set-cookie');
 if(!cookie)throw new Error('SESSION_CLEAR_UNAVAILABLE');
 const fallback={destination:`${configuration.origin}/login?error=signin`,cookie};
 try{const {data,error}=await startOAuth();if(!error&&data.url){const destination=new URL(data.url);if(destination.origin===configuration.providerOrigin&&!destination.username&&!destination.password)return {destination:destination.toString(),cookie};}}catch{/* No provider error or previous session is reused. */}
 return fallback;
}
