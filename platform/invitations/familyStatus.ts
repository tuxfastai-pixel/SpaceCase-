/** Status is canonical; elapsed time never confirms a contact. */
export function familyInvitationStatus(status:string){
 switch(status){
  case 'CLAIMED': return {label:'✓ Parent accepted · awaiting school review',tone:'accepted' as const};
  case 'CONFIRMED': return {label:'✓ School contact confirmed',tone:'confirmed' as const};
  case 'ISSUED': return {label:'Waiting for parent acceptance',tone:'waiting' as const};
  case 'EXPIRED': return {label:'Expired · create a new invitation',tone:'ended' as const};
  case 'REVOKED': return {label:'Revoked',tone:'ended' as const};
  case 'DECLINED': return {label:'School declined',tone:'ended' as const};
  case 'WITHDRAWN': return {label:'Parent withdrew',tone:'ended' as const};
  default:return {label:'Status unavailable',tone:'ended' as const};
 }
}
