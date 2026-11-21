'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import EntryPaths from '../onboarding/EntryPaths';
import {parentHomeSchema} from '../../platform/family/homeContracts';
import s from './dashboard.module.css';
/** Recheck an already-open welcome page after school access changes. No form is submitted. */
export default function UnassignedWorkspace(){
 const router=useRouter();
 useEffect(()=>{let active=true;let controller:AbortController|undefined;const check=async()=>{if(document.visibilityState!=='visible')return;controller?.abort();controller=new AbortController();try{const r=await fetch('/api/v1/family/home',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!r.ok)return;const home=parentHomeSchema.parse(await r.json());if(active&&home.hasSchoolHistory)router.replace('/parent');}catch{/* Keep the welcome choices when discovery cannot be confirmed. */}};void check();const timer=window.setInterval(()=>void check(),30000);const focus=()=>void check();window.addEventListener('focus',focus);return()=>{active=false;controller?.abort();window.clearInterval(timer);window.removeEventListener('focus',focus);};},[router]);
 return <main className={s.page}><header className={s.topbar}><a href='/parent'>Family workspace</a><a href='/help/parents'>Need a hand?</a><form action='/auth/google' method='post'><button className={s.secondaryButton}>Use another Google account</button></form><form action='/auth/logout' method='post'><button className={s.secondaryButton}>Sign out</button></form></header><div className={s.content}><section className={s.hero}><div><p className={s.eyebrow}>Welcome to SpaceCase</p><h1>Let’s find your workspace</h1><p>Choose what you came to do. If your school has just connected your parent account, we’ll take you to your family workspace.</p></div></section><EntryPaths/></div></main>;
}
