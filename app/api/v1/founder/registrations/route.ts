import {registrationProxy} from '@/platform/onboarding/registrationProxy';
export async function GET(request:Request){return registrationProxy(request,'/v1/spacecase/founder/registrations'+new URL(request.url).search);}
