import {registrationProxy} from '@/platform/onboarding/registrationProxy';
type Context={params:Promise<{requestId:string}>};
export async function GET(request:Request,{params}:Context){return registrationProxy(request,'/v1/spacecase/founder/registrations/'+encodeURIComponent((await params).requestId));}
export async function PATCH(request:Request,{params}:Context){return registrationProxy(request,'/v1/spacecase/founder/registrations/'+encodeURIComponent((await params).requestId));}
