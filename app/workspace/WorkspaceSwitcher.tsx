'use client';
import s from './workspace.module.css';
export default function WorkspaceSwitcher({current,schoolId,principal}:{current:'PRINCIPAL'|'ADMIN';schoolId:string;principal:boolean}){
 if(!principal)return <span className={s.label}>School administration</span>;
 return <label className={s.switcher}><span className={s.srOnly}>Switch school workspace</span><select aria-label='Switch school workspace' value={current} onChange={e=>window.location.assign(`${e.target.value==='PRINCIPAL'?'/principal':'/admin'}?school=${encodeURIComponent(schoolId)}`)}><option value='PRINCIPAL'>Principal overview</option><option value='ADMIN'>School administration</option></select></label>;
}
