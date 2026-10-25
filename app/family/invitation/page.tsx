import {familyInvitationsEnabled} from '@/platform/family/invitationConfig';import FamilyInvitation from './FamilyInvitation';
export const dynamic='force-dynamic';
export default function Page(){if(!familyInvitationsEnabled())return <main><h1>Family invitations</h1><p>School family invitations are not activated yet. Your private draft is still available.</p><a href='/family/onboarding'>Family setup</a></main>;return <FamilyInvitation/>;}
