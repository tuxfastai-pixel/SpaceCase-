import {registrationProxy} from '@/platform/onboarding/registrationProxy';type Context={params:Promise<{schoolId:string}>};
export async function GET(request:Request,{params}:Context){return registrationProxy(request,'/v1/admin/schools/'+encodeURIComponent((await params).schoolId)+'/finance-staff');}
export async function DELETE(request:Request,{params}:Context){return registrationProxy(request,'/v1/admin/schools/'+encodeURIComponent((await params).schoolId)+'/finance-staff');}
