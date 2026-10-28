import {registrationProxy} from '@/platform/onboarding/registrationProxy';
export async function DELETE(request:Request,{params}:{params:Promise<{requestId:string}>}){return registrationProxy(request,'/v1/school-registration/requests/'+encodeURIComponent((await params).requestId));}
