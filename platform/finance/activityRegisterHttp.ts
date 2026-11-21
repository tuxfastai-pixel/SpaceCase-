import {boundedText} from '../http/boundedText';
import {getDatabasePool} from '../db/pool';
import {requireSchoolFinancePermission} from './peosAuthorization';
import {financeFailure} from './workspaceHttp';
import {registerQuery,registerCommand} from '../../domains/school-activities/registerContracts';
import {readActivityRegister,writeActivityRegister} from '../../domains/school-activities/registerService';
export const activityRegisterEnabled=()=>process.env.SPACECASE_ACTIVITY_REGISTER_ENABLED==='true'&&process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED==='true'&&process.env.SPACECASE_WORKSPACE_MODE!=='authority_only';
type Deps={pool:typeof getDatabasePool;permission:typeof requireSchoolFinancePermission};
export function activityRegisterHandler(deps:Deps={pool:getDatabasePool,permission:requireSchoolFinancePermission}){return async(request:Request)=>{
 const headers={'cache-control':'no-store'};
 if(!activityRegisterEnabled())return Response.json({error:'ACTIVITY_REGISTER_NOT_ENABLED'},{status:503,headers});
 try{
  if(!['GET','POST'].includes(request.method))return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
  if(request.method==='POST'&&(!process.env.SPACECASE_PUBLIC_URL||request.headers.get('origin')!==new URL(process.env.SPACECASE_PUBLIC_URL).origin))return Response.json({error:'FORBIDDEN'},{status:403,headers});
  const params=new URL(request.url).searchParams;
  for(const key of params.keys())if(params.getAll(key).length!==1)throw new SyntaxError();
  if(request.method==='POST'&&params.size)throw new SyntaxError();
  const command=request.method==='POST'?registerCommand.parse(JSON.parse(await boundedText(request,30000))):null;
  const input=command??registerQuery.parse(Object.fromEntries(params));
  const authorize=(school:string,action:Parameters<typeof requireSchoolFinancePermission>[2])=>deps.permission(request,school,action);
  const decision=await authorize(input.schoolId,request.method==='GET'?'finance.transactions.read':command&&['SAVE_CALENDAR','APPROVE_ACTIVITY','REJECT_ACTIVITY','PUBLISH_ACTIVITY','CANCEL_ACTIVITY'].includes(command.command)?'finance.policy.manage':'finance.transactions.record');
  const scope={schoolId:input.schoolId,accountId:input.accountId,actorPersonId:decision.personId};
  return Response.json(command?await writeActivityRegister(deps.pool(),scope,command,authorize):await readActivityRegister(deps.pool(),scope,authorize),{headers});
 }catch(error){return financeFailure(error);}
};}
