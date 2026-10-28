import {registrationProxy} from '@/platform/onboarding/registrationProxy';
export async function GET(request:Request){return registrationProxy(request,'/v1/school-registration/requests'+new URL(request.url).search);}
export async function POST(request:Request){return registrationProxy(request,'/v1/school-registration/requests');}
