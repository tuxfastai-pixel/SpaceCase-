"use client";
import {useEffect,useState} from 'react';
import {nextFlowChoice,uploadHint} from './flowGuidance';
import s from './flowGuidance.module.css';
type Control=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement;
type Guide={target:Control;label:string;hint:string};
function labelFor(target:Control){
 const label=target.labels?.[0];
 return target.getAttribute('data-guide-label')||target.getAttribute('aria-label')||
  (label?Array.from(label.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim():'')||
  (target instanceof HTMLButtonElement?target.textContent?.trim():'')||'the next required field';
}
export default function FlowGuidance(){
 const [guide,setGuide]=useState<Guide|null>(null);
 const [dismissed,setDismissed]=useState<Control|null>(null);
 useEffect(()=>{
  let scope:HTMLElement|null=null,fileFocus:HTMLInputElement|null=null,step='',paused=false,frame=0,highlight:Control|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  const clearHighlight=()=>{highlight?.classList.remove(s.attention);highlight=null;if(timer)clearTimeout(timer);};
  const update=()=>{
   frame=0;
   if(!scope?.isConnected){scope=document.querySelector<HTMLElement>('[data-guided-flow][data-guide-start]');paused=false;if(!scope){clearHighlight();setGuide(null);return;}}
   const currentStep=scope.getAttribute('data-guide-step')??'';
   if(currentStep!==step){step=currentStep;paused=false;}
   if(paused||document.querySelector('[aria-label="Submission confirmation"]')){clearHighlight();setGuide(null);return;}
   const controls=Array.from(scope.querySelectorAll<Control>('input,select,textarea,button')).filter(c=>!c.closest('[data-guide-panel]'));
   const index=nextFlowChoice(controls.map(c=>({visible:c.getClientRects().length>0&&!c.closest('[hidden]'),disabled:c.matches(':disabled'),required:'required' in c&&c.required,valid:c.validity.valid,priority:c.hasAttribute('data-guide-priority')||fileFocus===c,action:c.hasAttribute('data-guide-next')||(c instanceof HTMLButtonElement&&c.type==='submit'&&c.form!==null)})));
   const target=controls[index];
   if(!target){clearHighlight();setGuide(null);return;}
   const label=labelFor(target);
   const hint=target.getAttribute('data-guide-hint')||(target instanceof HTMLInputElement&&target.type==='file'?uploadHint(target.accept):target instanceof HTMLButtonElement?'Review your choices, then select this button when you are ready. Nothing is submitted automatically.':target instanceof HTMLSelectElement?'Choose the option that matches this task.':'Complete this field, then the next required step will be highlighted.');
   setGuide(old=>old?.target===target&&old.hint===hint&&old.label===label?old:{target,label,hint});
   if(highlight!==target){clearHighlight();highlight=target;target.classList.add(s.attention);timer=setTimeout(()=>target.classList.remove(s.attention),4500);}
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const activate=(event:Event)=>{
   const target=event.target;if(!(target instanceof HTMLElement)||target.closest('[data-guide-panel]'))return;
   const next=target.closest<HTMLElement>('[data-guided-flow]')??target.closest<HTMLFormElement>('form')??(target instanceof HTMLInputElement&&target.type==='file'?target.closest<HTMLElement>('section,details'):null);
   if(next&&!next.querySelector('input:not([type="hidden"]),select,textarea')&&!next.hasAttribute('data-guided-flow'))return;
   fileFocus=event.type==='focusin'&&target instanceof HTMLInputElement&&target.type==='file'?target:null;
   scope=next;step=scope?.getAttribute('data-guide-step')??'';paused=false;schedule();
  };
  const submit=(event:Event)=>{if((event.target instanceof HTMLFormElement&&scope?.contains(event.target))||event.target===scope){paused=true;clearHighlight();setGuide(null);}};
  document.addEventListener('focusin',activate);document.addEventListener('change',activate);document.addEventListener('invalid',activate,true);document.addEventListener('submit',submit,true);
  const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','aria-busy','data-guide-step','data-guide-priority']});
  // Explicit multi-step flows can guide their first action immediately after rendering.
  scope=document.querySelector<HTMLElement>('[data-guided-flow][data-guide-start]');if(scope)schedule();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);clearHighlight();document.removeEventListener('focusin',activate);document.removeEventListener('change',activate);document.removeEventListener('invalid',activate,true);document.removeEventListener('submit',submit,true);};
 },[]);
 if(!guide||!guide.target.isConnected||dismissed===guide.target)return null;
 return <aside data-guide-panel className={s.panel} aria-label='Next step guidance'><p role='status'><strong>Next: {guide.label}</strong></p><p>{guide.hint}</p><div><button type='button' onClick={()=>{setDismissed(null);guide.target.scrollIntoView({block:'center',behavior:'auto'});guide.target.focus({preventScroll:true});}}>Show me</button><button type='button' onClick={()=>setDismissed(guide.target)}>Hide hint</button></div></aside>;
}
