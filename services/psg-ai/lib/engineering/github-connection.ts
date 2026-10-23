import {getTokenResponse} from '@vercel/connect';
import {verifyGithubEvidence} from '../../../../packages/engineering-control/github-evidence';

// Dedicated read-only GitHub App, installed only on SpaceCase-. Never supplied by a browser request.
const connector='github/spacecase-review-verifier',installationId='174457593';
const projectId='prj_hTrszwXwHwZTKiusnqcn0iTv9o1c';
type Environment=Record<string,string|undefined>;

export async function githubReviewCredential(signal:AbortSignal,env:Environment=process.env,exchange:typeof getTokenResponse=getTokenResponse):Promise<string|null>{
 if(env.PSG_ENGINEERING_GITHUB_CONNECT_ENABLED!=='true')return null;
 if(env.VERCEL_PROJECT_ID!==projectId||(env.VERCEL_TARGET_ENV??env.VERCEL_ENV)!=='production')throw Error('REVIEW_THREADS_UNVERIFIED');
 signal.throwIfAborted();
 // No scopes are exposed for this provider. The installed App grants only metadata and pull-request read.
 // Refresh each verification so a revoked Connect grant cannot authorize a new decision from cached credentials.
 let abort:()=>void=()=>{};
 try{
  const stopped=new Promise<never>((_,reject)=>{abort=()=>reject(Error('REVIEW_THREADS_UNVERIFIED'));signal.addEventListener('abort',abort,{once:true});});
  const response=await Promise.race([exchange(connector,{subject:{type:'app'},installationId},{forceRefresh:true}),stopped]);
  signal.throwIfAborted();
  if(response.connector.uid!==connector||response.connector.type!=='github'||response.installationId!==installationId||response.tenantId!=='252553395'||!Number.isFinite(response.expiresAt)||response.expiresAt<=Date.now()+10000)throw Error('REVIEW_THREADS_UNVERIFIED');
  return response.token;
 }catch{throw Error('REVIEW_THREADS_UNVERIFIED');}finally{signal.removeEventListener('abort',abort);}
}

export const verifyManagedGithubEvidence:typeof verifyGithubEvidence=(packet,digest,inspection)=>verifyGithubEvidence(packet,digest,inspection,{fetch,getReadToken:githubReviewCredential});
