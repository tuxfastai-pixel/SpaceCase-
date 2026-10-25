import {z} from 'zod';
import {familyInvitationsEnabled} from '@/platform/family/invitationConfig';
import {peosProxy,sameOrigin} from '@/platform/admin/peosProxy';
import {boundedText} from '@/platform/http/boundedText';
const schema=z.object({learnerPersonId:z.string().uuid(),email:z.string().trim().email().max(254),relationship:z.enum(['PARENT','GUARDIAN','CAREGIVER'])}).strict();
export async function GET(r:Request,{params}:{params:Promise<{schoolId:string}>}){if(!familyInvitationsEnabled())return Response.json({error:'FAMILY_INVITATIONS_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store'}});const p=await params;if(!z.string().uuid().safeParse(p.schoolId).success)return Response.json({error:'INVALID_INPUT'},{status:400});return peosProxy(r,`/v1/admin/schools/${p.schoolId}/family-invitations`);}
export async function POST(r:Request,{params}:{params:Promise<{schoolId:string}>}){if(!familyInvitationsEnabled())return Response.json({error:'FAMILY_INVITATIONS_UNAVAILABLE'},{status:503});if(!sameOrigin(r))return Response.json({error:'FORBIDDEN'},{status:403});try{const p=await params;z.string().uuid().parse(p.schoolId);const input=schema.parse(JSON.parse(await boundedText(r,2048)));return peosProxy(r,`/v1/admin/schools/${p.schoolId}/family-invitations`,input);}catch{return Response.json({error:'INVALID_INPUT'},{status:400});}}
