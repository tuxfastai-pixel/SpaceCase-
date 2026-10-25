import type {FamilyDraft} from './contracts';
export type FamilyReadinessIssue={code:'PARENT_NAME'|'PARENT_CONTACT'|'CHILD_NAME'|'CHILD_BIRTH_DATE'|'CHILD_PHOTO'|'SCHOOL_NAME';step:0|1|2;childId?:string;message:string};
/** Completeness only. Never evidence of identity, guardianship, school membership or consent. */
export function familyReadiness(profile:FamilyDraft,photoChildIds:readonly string[]){
 const issues:FamilyReadinessIssue[]=[];const photos=new Set(photoChildIds);
 if(!profile.parent.givenName.trim()||!profile.parent.familyName.trim())issues.push({code:'PARENT_NAME',step:0,message:'Add your given name and family name / surname.'});
 if(!profile.parent.phone.trim()&&!profile.parent.email.trim())issues.push({code:'PARENT_CONTACT',step:0,message:'Add a cellphone number or contact email so the school can contact you.'});
 profile.children.forEach((child,index)=>{const name=child.givenName.trim()||`Child ${index+1}`;
 if(!child.givenName.trim()||!child.familyName.trim())issues.push({code:'CHILD_NAME',step:1,childId:child.id,message:`${name}: add given name and family name / surname.`});
 if(!child.dateOfBirth)issues.push({code:'CHILD_BIRTH_DATE',step:1,childId:child.id,message:`${name}: add a complete date of birth.`});
 if(!photos.has(child.id))issues.push({code:'CHILD_PHOTO',step:1,childId:child.id,message:`${name}: take or upload a profile photo.`});
 if(!child.schoolName.trim())issues.push({code:'SCHOOL_NAME',step:2,childId:child.id,message:`${name}: enter the school name. The school must still confirm the connection.`});
 });
 return {detailsComplete:issues.length===0,issues,schoolConnectionVerified:false as const,submissionAvailable:false as const};
}
