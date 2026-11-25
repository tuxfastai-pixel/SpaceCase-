'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {searchParts} from './matches';
import s from './search.module.css';
export function SearchMatch({text,query}:{text:string;query:string}){return <>{searchParts(text,query).map((part,i)=>part.match?<mark className={s.match} key={i}>{part.text}</mark>:part.text)}</>;}
/** Keep typing focus in live searches; only submitted results receive focus. */
export function SearchResults({active,focusKey,children,label='Search results'}:{active:boolean;focusKey?:unknown;children:ReactNode;label?:string}){
 const region=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!active||focusKey===undefined)return;const frame=requestAnimationFrame(()=>{region.current?.scrollIntoView({block:'start',behavior:'auto'});region.current?.focus({preventScroll:true});});return()=>cancelAnimationFrame(frame);},[active,focusKey]);
 return <div ref={region} role='region' aria-label={label} tabIndex={-1} className={active?s.results:undefined}>{children}</div>;
}
