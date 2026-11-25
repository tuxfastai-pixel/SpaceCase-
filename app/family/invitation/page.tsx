import {cookies} from 'next/headers';
import {familyInvitationsEnabled,FAMILY_INVITATION_COOKIE} from '@/platform/family/invitationConfig';
import {createAuthClient} from '@/platform/auth/supabase';
import FamilyInvitation from './FamilyInvitation';
export const dynamic='force-dynamic';
export default async function Page(){
 if(!familyInvitationsEnabled())return <main><h1>Family invitations</h1><p>School family invitations are not activated yet. Your private draft is still available.</p><a href='/family/onboarding'>Family setup</a></main>;
 let signedIn=false;
 try{const {data,error}=await (await createAuthClient()).auth.getUser();signedIn=!error&&Boolean(data.user);}catch{/* Show sign-in when the current identity cannot be verified. */}
 return <FamilyInvitation signedIn={signedIn} hasPending={(await cookies()).has(FAMILY_INVITATION_COOKIE)}/>;
}
