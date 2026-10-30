import { z } from "zod";
import { getDatabasePool } from "@/platform/db/pool";
import { requireSchoolFinancePermission, FinanceAuthorizationError } from "@/platform/finance/peosAuthorization";
import { allocateVerifiedSchoolPayment } from "@/domains/school-finance/allocationService";
import { SchoolFinanceError } from "@/domains/school-finance/money";

const inputSchema=z.object({
  schoolId:z.string().uuid(), accountId:z.string().uuid(), paymentId:z.string().uuid(),
  invoiceId:z.string().uuid(), amountMinor:z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
}).strict();

export async function POST(request:Request){
  // Explicit rollout gate. A deployment never activates this route by default.
  if(process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED!=="true")
    return Response.json({error:"FINANCE_NOT_ENABLED"},{status:503});
  const origin=request.headers.get("origin");
  if(!origin || origin!==new URL(request.url).origin)
    return Response.json({error:"FORBIDDEN"},{status:403});
  const parsed=inputSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:"INVALID_INPUT"},{status:400});
  try{
    const authority=await requireSchoolFinancePermission(request,parsed.data.schoolId,"finance.transactions.record");
    const result=await allocateVerifiedSchoolPayment(
      getDatabasePool(),{...parsed.data,actorPersonId:authority.personId},
      async(schoolId,action)=>requireSchoolFinancePermission(request,schoolId,action),
    );
    return Response.json(result,{status:201,headers:{"cache-control":"no-store"}});
  }catch(error){
    if(error instanceof FinanceAuthorizationError)
      return Response.json({error:error.message},{status:error.status});
    if(error instanceof SchoolFinanceError)
      return Response.json({error:error.message},{status:error.message==="FINANCE_FORBIDDEN"?403:409});
    return Response.json({error:"FINANCE_SERVICE_UNAVAILABLE"},{status:503});
  }
}
