'use client';
import {useEffect,useRef,useState} from 'react';
import s from '../onboarding/family.module.css';
export default function FamilyInvitation({signedIn=false,hasPending=false}:{signedIn?:boolean;hasPending?:boolean}){
 const initial=useRef<string|null>(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[ack,setAck]=useState(false),[signin,setSignin]=useState(!signedIn),[error,setError]=useState(''),[school,setSchool]=useState('');
 useEffect(()=>{
  let active=true;const token=initial.current??new URLSearchParams(window.location.hash.slice(1)).get('token');initial.current=token;
  if(token)window.history.replaceState(null,'','/family/invitation');
  if(!token){if(hasPending)setReady(true);else setError('Open the private invitation link your school sent you. If it has expired, ask the school for a new one.');return;}
  void fetch('/api/v1/family/invitation/pending',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(r=>{if(!r.ok)throw Error();if(active)setReady(true);}).catch(()=>{if(active)setError('We could not open your invitation. Open the link again, or ask the school for help.');});
  return()=>{active=false;};
 },[hasPending]);
 async function claim(){
  if(!ack||busy||signin)return;setBusy(true);setError('');
  try{const r=await fetch('/api/v1/family/invitation/claim',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json'},body:JSON.stringify({acknowledgement:true})});const d=await r.json();
   if(r.status===401||d.error==='INVITED_EMAIL_REQUIRED'){setSignin(true);setError('Choose the Google account with the email your school invited. Your invitation will stay here while you sign in.');return;}
   if(!r.ok)throw Error('Your acceptance could not be confirmed. Check My school connections before trying again, or ask your school for help.');setSchool(d.schoolName);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <main className={s.page}><p>SpaceCase · Your school invitation</p><h1>Connect with your child’s school</h1>
 {error?<p className={s.error} role='alert'>{error}</p>:null}
 {school?<section className={s.card}><h2>Invitation accepted</h2><p role='status'>{school} will now check your connection. You can follow the update under My school connections.</p><p><a href='/family/connections'>View my school connection</a></p><p>No learner records are opened until the school completes the required checks.</p><a href='/parent'>Go to my family workspace</a></section>:
 <section className={s.card} data-guided-flow data-guide-start data-guide-step={signin?'signin':'accept'}>
 <p>Two quick steps: sign in with the email your school invited, then accept your invitation.</p>
 {signin?<><h2>1. Sign in</h2><p>Use the Google email you gave the school. You do not need a Vercel account.</p><form action='/auth/google' method='post'><input type='hidden' name='onboarding' value='parent'/><button className={s.primary} disabled={!ready||busy} data-guide-next data-guide-hint='Choose the Google account with the email your school invited. You will return here to accept.'>Continue with Google</button></form></>:
 <><h2>2. Accept your invitation</h2><label className={s.check}><input type='checkbox' required checked={ack} disabled={!ready||busy} onChange={e=>setAck(e.target.checked)}/>I am the intended parent or caregiver and ask the school to confirm my connection.</label><button className={s.primary} disabled={!ready||!ack||busy} data-guide-next onClick={()=>void claim()}>{busy?'Saving your acceptance…':'Accept invitation'}</button><form action='/auth/google' method='post'><input type='hidden' name='onboarding' value='parent'/><button disabled={!ready||busy}>Use a different Google account</button></form></>}
 {!ready&&!error?<p role='status'>Opening your invitation…</p>:null}<p>Your private family setup stays private. The school reviews your connection before school records can be shared.</p></section>}
 <p><a href='/family/connections'>My school connections</a> · <a href='/parent'>Family workspace</a></p></main>;
}
