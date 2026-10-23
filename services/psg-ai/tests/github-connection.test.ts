import test from 'node:test';
import assert from 'node:assert/strict';
import {githubReviewCredential} from '../lib/engineering/github-connection';
import type {getTokenResponse} from '@vercel/connect';
const env={PSG_ENGINEERING_GITHUB_CONNECT_ENABLED:'true',VERCEL_PROJECT_ID:'prj_hTrszwXwHwZTKiusnqcn0iTv9o1c',VERCEL_ENV:'production'};
const response=()=>({token:'synthetic-read-token-only',expiresAt:Date.now()+3600000,connector:{id:'scl_IFJYtZQNSMX7PyRpy42L9w',uid:'github/spacecase-review-verifier',type:'github'},installationId:'174457593',tenantId:'252553395'});
test('managed credentials require explicit activation and the PSG production project before any exchange',async()=>{
 let calls=0;const exchange:typeof getTokenResponse=async()=>{calls++;return response();};
 assert.equal(await githubReviewCredential(new AbortController().signal,{},exchange),null);
 for(const changed of [{VERCEL_PROJECT_ID:'product-project'},{VERCEL_ENV:'preview'},{VERCEL_TARGET_ENV:'staging'}])await assert.rejects(githubReviewCredential(new AbortController().signal,{...env,...changed},exchange));
 assert.equal(calls,0);
});
test('exchange pins the app and installation, bypasses cached grants and validates credential metadata',async()=>{
 const exchange:typeof getTokenResponse=async(connector,params,options)=>{assert.equal(connector,'github/spacecase-review-verifier');assert.deepEqual(params,{subject:{type:'app'},installationId:'174457593'});assert.deepEqual(options,{forceRefresh:true});return response();};
 assert.equal(await githubReviewCredential(new AbortController().signal,env,exchange),'synthetic-read-token-only');
 for(const changed of [{installationId:'other'},{tenantId:'other'},{expiresAt:0},{expiresAt:NaN},{connector:{id:'other',uid:'github/other',type:'github'}}])await assert.rejects(githubReviewCredential(new AbortController().signal,env,async()=>({...response(),...changed})),/^Error: REVIEW_THREADS_UNVERIFIED$/);
 await assert.rejects(githubReviewCredential(new AbortController().signal,env,async()=>{throw Error('provider error with sensitive details');}),/^Error: REVIEW_THREADS_UNVERIFIED$/);
});
test('cancellation bounds an unavailable token exchange and never returns late credentials',async()=>{
 const controller=new AbortController();let complete!:(value:ReturnType<typeof response>)=>void;
 const pending=githubReviewCredential(controller.signal,env,()=>new Promise(resolve=>{complete=resolve;}));
 controller.abort();await assert.rejects(pending,/REVIEW_THREADS_UNVERIFIED/);complete(response());
 let calls=0;await assert.rejects(githubReviewCredential(controller.signal,env,async()=>{calls++;return response();}));assert.equal(calls,0);
});
