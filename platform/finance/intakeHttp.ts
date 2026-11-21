import {z} from 'zod';
import {boundedText} from '../http/boundedText';
import {getDatabasePool} from '../db/pool';
import {requireSchoolFinancePermission} from './peosAuthorization';
import {financeFailure} from './workspaceHttp';
import {IntakeError,intakeUpload} from '../../domains/school-finance/intakeCsv';
import {actOnIntake,importIntake,listIntake,previewIntake} from '../../domains/school-finance/intakeService';
const scope={schoolId:z.string().uuid().toLowerCase(),accountId:z.string().uuid()};
const upload=intakeUpload.shape;
const command=z.discriminatedUnion('command',[
 z.object({...scope,...upload,command:z.literal('PREVIEW')}).strict(),
 z.object({...scope,...upload,command:z.literal('IMPORT'),previewDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({...scope,command:z.literal('REPORT'),candidateId:z.string().uuid()}).strict(),
 z.object({...scope,command:z.enum(['DISMISS','CONFIRM_DISTINCT']),candidateId:z.string().uuid(),reason:z.string().trim().min(1).max(500)}).strict(),
]);
const query=z.object({...scope,before:z.string().uuid().optional()}).strict();
export const intakeEnabled=()=>process.env.SPACECASE_FINANCE_INTAKE_ENABLED==='true'&&process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED==='true'&&process.env.SPACECASE_WORKSPACE_MODE!=='authority_only';
const headers={'cache-control':'no-store'};
type Deps={pool:typeof getDatabasePool;permission:typeof requireSchoolFinancePermission};
export function intakeHandler(deps:Deps={pool:getDatabasePool,permission:requireSchoolFinancePermission}){
 return async(request:Request)=>{
  if(!intakeEnabled())return Response.json({error:'PAYMENT_INTAKE_NOT_ENABLED'},{status:503,headers});
  try{
   if(request.method!=='GET'&&request.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
   if(request.method==='POST'){
    const configured=process.env.SPACECASE_PUBLIC_URL;
    if(!configured||request.headers.get('origin')!==new URL(configured).origin)return Response.json({error:'FORBIDDEN'},{status:403,headers});
   }
   const params=new URL(request.url).searchParams;
   for(const key of params.keys())if(params.getAll(key).length!==1)throw new SyntaxError('Repeated parameter');
   const input=request.method==='GET'?query.parse(Object.fromEntries(params)):command.parse(JSON.parse(await boundedText(request,524288)));
   const authorize=(school:string,action:Parameters<typeof requireSchoolFinancePermission>[2])=>deps.permission(request,school,action);
   const authority=await authorize(input.schoolId,request.method==='GET'?'finance.transactions.read':'finance.transactions.record');
   const context={schoolId:input.schoolId,accountId:input.accountId,actorPersonId:authority.personId};
   let result;
   if(!('command' in input))result=await listIntake(deps.pool(),context,input.before,authorize);
   else if(input.command==='PREVIEW'||input.command==='IMPORT'){
    const upload=intakeUpload.parse({source:input.source,csv:input.csv,delimiter:input.delimiter,decimalSeparator:input.decimalSeparator,mapping:input.mapping});
    result=input.command==='PREVIEW'?await previewIntake(deps.pool(),context,upload,authorize):await importIntake(deps.pool(),context,upload,input.previewDigest,authorize);
   }else result=await actOnIntake(deps.pool(),context,{candidateId:input.candidateId,action:input.command,...('reason' in input?{reason:input.reason}:{})},authorize);
   return Response.json(result,{headers});
  }catch(error){if(error instanceof IntakeError)return Response.json({error:error.code},{status:error.status,headers});return financeFailure(error);}
 };
}
