'use client';
import {familyReadiness} from '../../../domains/family/readiness';
import type {FamilyDraft} from '../../../domains/family/contracts';
export default function FamilyReadiness({profile,photos,dirty,onStep}:{profile:FamilyDraft;photos:string[];dirty:boolean;onStep:(step:number)=>void}){
 const result=familyReadiness(profile,photos);
 return <section aria-labelledby='family-readiness-title'><h2 id='family-readiness-title'>Before school verification</h2><p>{result.detailsComplete?'Your essential details and child photos are entered. School verification is still pending.':`${result.issues.length} ${result.issues.length===1?'item needs':'items need'} attention. You can save an unfinished draft and return later.`}</p>
 {result.issues.length?<ul>{result.issues.map(issue=><li key={`${issue.code}:${issue.childId??'parent'}`}><button type='button' onClick={()=>onStep(issue.step)}>{issue.message}</button></li>)}</ul>:null}
 {dirty?<p>Save your changes before leaving. Photo controls become available after the draft details are saved.</p>:null}
 <p><strong>School connection: not verified.</strong> A school name or learner reference does not connect your account to school records. School submission is not available yet.</p><p>A second parent, additional family contacts and a home address are optional. A learner reference can stay blank if you do not know it.</p>
 </section>;
}
