import {LOGIN_SCHOOL_COOKIE} from './loginBranding';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {readServerEnvironment} from '../config/env';
import {currentSession} from '../auth/currentSession';
import {sameOrigin,adminSchools} from '../admin/peosProxy';
import {getDatabasePool} from '../db/pool';
import {boundedText} from '../http/boundedText';
import {resolvePeosAuthorization} from '../session/peosAuthorization';
import {listBillingScopes,requireFamilyBilling,familyFinanceEnabled} from '../family/billingAuthority';
import {accountKeyInput} from '../family/accountNavigation';
import {readFamilyDraft} from '../../domains/family/service';
import {financeSchools} from '../finance/peosAuthorization';
import {peosRead} from '../support/authority';
import {AppearanceError,accountPhoto,chooseAccountPhoto,normalizeLogo} from './service';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const query=z.object({kind:z.enum(['photo','choices','logo']),account:z.string().regex(/^[a-f0-9]{64}$/).optional(),school:z.string().uuid().optional(),view:z.enum(['admin','finance','teacher']).optional()}).strict();
const defaults={session:currentSession as ()=>Promise<{personId:string}|null>,origin:sameOrigin,pool:getDatabasePool,directory:listBillingScopes,authorize:requireFamilyBilling,admin:adminSchools,finance:financeSchools,teacher:peosRead,enabled:familyFinanceEnabled,operational:()=>readServerEnvironment().SPACECASE_WORKSPACE_MODE==='operational'};
export function appearanceHandler(overrides:Partial<typeof defaults>={}){const deps={...defaults,...overrides};return async function(request:Request){try{

 if(request.method!=='GET'&&!deps.origin(request))throw new AppearanceError(403,'FORBIDDEN');
 const session=await deps.session(),authorization=resolvePeosAuthorization(request);if(!session||!authorization)throw new AppearanceError(401,'UNAUTHENTICATED');
 if(!deps.operational())throw new AppearanceError(503,'APPEARANCE_UNAVAILABLE');
 const params=new URL(request.url).searchParams;if([...params.keys()].some(k=>params.getAll(k).length!==1))throw new AppearanceError(400,'INVALID_INPUT');
 const q=query.parse(Object.fromEntries(params));let school=q.school,learner='',schoolName='';
 if(q.account){if(!deps.enabled())throw new AppearanceError(403,'ACCESS_REQUIRED');const directory=await deps.directory(request),scope=directory.scopes.find(s=>Date.parse(s.expiresAt)>Date.now()&&createHash('sha256').update(accountKeyInput(s.grantId)).digest('hex')===q.account);if(!scope)throw new AppearanceError(403,'ACCESS_REQUIRED');await deps.authorize(request,scope.grantId,'family.finance.read');schoolName=scope.schoolName;school=scope.schoolId;learner=scope.learnerPersonId;if(q.school&&q.school!==school)throw new AppearanceError(403,'ACCESS_REQUIRED');}
 if(q.kind==='photo'||q.kind==='choices'){
 if(!q.account||!school||q.view)throw new AppearanceError(400,'INVALID_INPUT');const pool=deps.pool();
 if(q.kind==='choices'){if(request.method!=='GET')throw new AppearanceError(405,'METHOD_NOT_ALLOWED');const draft=await readFamilyDraft(pool,session.personId);return Response.json({children:(draft.profile?.children??[]).filter(c=>draft.photos.includes(c.id)).map(c=>({id:c.id,name:`${c.givenName} ${c.familyName}`.trim()}))},{headers});}
 if(request.method==='GET')return new Response(new Uint8Array(await accountPhoto(pool,session.personId,school,learner)),{headers:{...headers,'content-type':'image/jpeg'}});
 if(request.method==='PUT'){const value=z.object({child:z.string().uuid()}).strict().parse(JSON.parse(await boundedText(request,256)));await chooseAccountPhoto(pool,session.personId,school,learner,value.child);return Response.json({saved:true},{headers});}
 if(request.method==='DELETE'){await pool.query('DELETE FROM family_intake.account_photos WHERE owner_person_id=$1 AND school_id=$2 AND learner_person_id=$3',[session.personId,school,learner]);return Response.json({removed:true},{headers});}
 }else{
 if(!school)throw new AppearanceError(400,'INVALID_INPUT');
 if(request.method!=='GET'||!q.account){
 if(q.account||!q.view)throw new AppearanceError(403,'ACCESS_REQUIRED');
 if(q.view==='admin'){const schools=await deps.admin(authorization);schoolName=schools.find(s=>s.id===school)?.displayName??'';if(!schoolName)throw new AppearanceError(403,'ACCESS_REQUIRED');}
 else{if(request.method!=='GET')throw new AppearanceError(403,'ACCESS_REQUIRED');if(q.view==='finance'){const directory=await deps.finance(authorization);schoolName=directory.schools.find(s=>s.id===school)?.displayName??'';if(!schoolName)throw new AppearanceError(403,'ACCESS_REQUIRED');}else{const teacher=await deps.teacher(request,`/v1/people/${session.personId}/teacher-context`,z.object({personId:z.string(),schoolId:z.string(),active:z.boolean()}));if(!teacher.active||teacher.personId!==session.personId||teacher.schoolId!==school)throw new AppearanceError(403,'ACCESS_REQUIRED');}}
 }
 const pool=deps.pool();const brandHeaders={...headers,...(schoolName?{'set-cookie':`${LOGIN_SCHOOL_COOKIE}=${school}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${new URL(request.url).protocol==='https:'?'; Secure':''}`}:{})};if(schoolName)await pool.query('INSERT INTO presentation.school_login_branding(school_id,display_name) VALUES($1,$2) ON CONFLICT(school_id) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=now() WHERE presentation.school_login_branding.display_name IS DISTINCT FROM EXCLUDED.display_name',[school,schoolName]);if(request.method==='GET'){const r=await pool.query('SELECT jpeg FROM presentation.school_logos WHERE school_id=$1',[school]);if(!r.rows[0])throw new AppearanceError(404,'LOGO_NOT_FOUND');return new Response(new Uint8Array(r.rows[0].jpeg),{headers:{...brandHeaders,'content-type':'image/jpeg'}});}
 if(request.method==='PUT'){const raw=await boundedTextBytes(request),jpeg=await normalizeLogo(raw);await pool.query('INSERT INTO presentation.school_logos(school_id,jpeg,updated_by) VALUES($1,$2,$3) ON CONFLICT(school_id) DO UPDATE SET jpeg=EXCLUDED.jpeg,updated_by=EXCLUDED.updated_by,updated_at=now()',[school,jpeg,session.personId]);return Response.json({saved:true},{headers});}
 if(request.method==='DELETE'){await pool.query('DELETE FROM presentation.school_logos WHERE school_id=$1',[school]);return Response.json({removed:true},{headers});}
 }
 throw new AppearanceError(405,'METHOD_NOT_ALLOWED');
 }catch(e){const status=e instanceof AppearanceError?e.status:e instanceof z.ZodError||e instanceof SyntaxError?400:e instanceof RangeError?413:503;return Response.json({error:e instanceof AppearanceError?e.message:status===400?'INVALID_INPUT':status===413?'FILE_TOO_LARGE':'APPEARANCE_UNAVAILABLE'},{status,headers});}};}
export const appearanceRequest=appearanceHandler();
async function boundedTextBytes(r:Request){const reader=r.body?.getReader();if(!reader)throw new AppearanceError(400,'INVALID_LOGO');const chunks:Uint8Array[]=[];let size=0;try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>2097152){await reader.cancel();throw new RangeError();}chunks.push(p.value);}}finally{reader.releaseLock();}return Buffer.concat(chunks);}
