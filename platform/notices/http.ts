import {z} from 'zod';import {sameOrigin} from '../admin/peosProxy';import {boundedText} from '../http/boundedText';import {getDatabasePool} from '../db/pool';import {conversationCommand} from '../../domains/school-communications/contracts';import {uuid,noticeCommand} from '../../domains/school-notices/contracts';
import {NoticeError,publishSchoolNotice,parentNotices,staffNotices,noticeRecipients,withdrawNotice,boardConversation} from '../../domains/school-notices/service';
import {schoolNoticesEnabled,parentNoticeAuthority,noticeStaffDirectory,noticeAudience,NoticeAuthorityError} from './authority';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
export function noticeHttp(kind:'PARENT'|'STAFF'){return async(request:Request)=>{if(!schoolNoticesEnabled())return Response.json({error:'SCHOOL_NOTICES_NOT_ENABLED'},{status:503,headers});try{
 if(!['GET','POST'].includes(request.method))return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
 if(request.method==='POST'&&!sameOrigin(request))return Response.json({error:'FORBIDDEN'},{status:403,headers});
 const params=new URL(request.url).searchParams;if([...params.keys()].some(k=>params.getAll(k).length!==1))throw new SyntaxError();
 const q=z.object({mode:z.enum(['directory','audience']).optional(),schoolId:uuid.optional(),classId:uuid.optional(),noticeId:uuid.optional(),threadId:uuid.optional(),before:z.string().regex(/^[1-9][0-9]{0,18}$/).optional()}).strict().parse(Object.fromEntries(params));
 const pool=getDatabasePool(),parent=()=>parentNoticeAuthority(request),directory=()=>noticeStaffDirectory(request),staff=(school:string,c:string|null)=>noticeAudience(request,school,c);
 const access=kind==='PARENT'?{parent}:{staff};
 // Always authenticate before any local identifier lookup. The material operation rechecks scope.
 if(kind==='PARENT')await parent();else await directory();
 if(q.threadId){if(q.mode||q.schoolId||q.classId||q.noticeId||request.method==='POST'&&q.before)throw new SyntaxError();const command=request.method==='POST'?conversationCommand.parse(JSON.parse(await boundedText(request,8192))):undefined;return Response.json(await boardConversation(pool,q.threadId,access,command,q.before),{headers});}
 if(q.before)throw new SyntaxError();
 if(kind==='PARENT'){if(request.method!=='GET'||q.mode||q.schoolId||q.classId)throw new SyntaxError();return Response.json(await parentNotices(pool,parent,q.noticeId),{headers});}
 if(request.method==='POST'){const input=noticeCommand.parse(JSON.parse(await boundedText(request,65536)));if(input.command==='PUBLISH'){if(params.size)throw new SyntaxError();return Response.json(await publishSchoolNotice(pool,()=>staff(input.schoolId,input.classId),input),{headers});}if(!q.noticeId||params.size!==1)throw new SyntaxError();return Response.json(await withdrawNotice(pool,q.noticeId,input.requestId,access),{headers});}
 if(q.mode==='directory'&&params.size===1)return Response.json(await directory(),{headers});
 if(q.mode==='audience'&&q.schoolId&&!q.noticeId)return Response.json(await staff(q.schoolId,q.classId??null),{headers});
 if(q.noticeId&&params.size===1)return Response.json(await noticeRecipients(pool,q.noticeId,access),{headers});
 if(q.schoolId&&params.size===1)return Response.json(await staffNotices(pool,directory,q.schoolId),{headers});throw new SyntaxError();
 }catch(e){const status=e instanceof NoticeError?e.status:e instanceof NoticeAuthorityError?e.status:e instanceof z.ZodError||e instanceof SyntaxError?400:e instanceof RangeError?413:503;return Response.json({error:e instanceof NoticeError?e.code:status===400?'INVALID_INPUT':status===413?'REQUEST_TOO_LARGE':'NOTICE_ACCESS_UNAVAILABLE'},{status,headers});}};}
