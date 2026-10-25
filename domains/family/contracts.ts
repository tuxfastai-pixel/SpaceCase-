import {z} from 'zod';
const text=(max:number)=>z.string().trim().max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),'Remove unsupported characters.');
const email=text(254).refine(v=>v===''||z.string().email().safeParse(v).success,'Enter a valid email or leave it blank for now.');
export const relationship=z.enum(['MOTHER','FATHER','GUARDIAN','CAREGIVER','OTHER']);
function validBirth(value:string){if(!value)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>new Date().toISOString().slice(0,10))return false;const d=new Date(`${value}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
export const childDraft=z.object({id:z.string().uuid(),givenName:text(80),familyName:text(80),medicalInformation:text(300).default(''),dateOfBirth:text(10).refine(validBirth,'Enter a valid birth date that is not in the future.'),schoolName:text(120),gradeClass:text(80),schoolReference:text(40).refine(v=>!v||/^[A-Za-z0-9._/-]+$/.test(v),'References cannot contain spaces.')}).strict();
const contact=z.object({id:z.string().uuid(),givenName:text(80),familyName:text(80),relationship,phone:text(30),email,emergency:z.boolean()}).strict();
export const familyDraft=z.object({parent:z.object({givenName:text(80),familyName:text(80),relationship,phone:text(30),email}).strict(),children:z.array(childDraft).min(1).max(5).refine(xs=>new Set(xs.map(x=>x.id)).size===xs.length,'Duplicate child entry.'),contacts:z.array(contact).max(5).refine(xs=>new Set(xs.map(x=>x.id)).size===xs.length,'Duplicate contact entry.'),address:text(500),language:text(60),preferredContact:z.enum(['EMAIL','PHONE'])}).strict();
export type FamilyDraft=z.infer<typeof familyDraft>;
export const saveFamilyDraft=z.object({revision:z.number().int().min(0).max(2147483646),profile:familyDraft}).strict();
export function emptyChild(){return {id:crypto.randomUUID(),givenName:'',familyName:'',dateOfBirth:'',medicalInformation:'',schoolName:'',gradeClass:'',schoolReference:''};}
export function emptyFamily():FamilyDraft{return {parent:{givenName:'',familyName:'',relationship:'GUARDIAN',phone:'',email:''},children:[emptyChild()],contacts:[],address:'',language:'',preferredContact:'EMAIL'};}
export function ageOn(birth:string,today:string){if(!birth||birth>today||!/^\d{4}-\d{2}-\d{2}$/.test(birth))return null;const year=Number(today.slice(0,4))-Number(birth.slice(0,4));return year-(today.slice(5)<birth.slice(5)?1:0);}
export class FamilyDraftError extends Error{constructor(public code:string,public status=409){super(code);}}
