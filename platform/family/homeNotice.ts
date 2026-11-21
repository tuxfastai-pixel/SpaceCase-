import type {Pool} from 'pg';
import {z} from 'zod';
import type {ParentHomeState} from './homeContracts';
export const acknowledgeHomeInput=z.object({noticeKey:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export class HomeNoticeChanged extends Error{}
export async function homeNoticeSeen(pool:Pick<Pool,'query'>,owner:string,key:string){
 const result=await pool.query('SELECT 1 FROM family_intake.home_acknowledgements WHERE owner_person_id=$1 AND notice_key=$2',[owner,key]);return result.rows.length>0;
}
/** The owner comes from the verified session; the key must match freshly discovered access. */
export async function acknowledgeHomeNotice(pool:Pick<Pool,'query'>,owner:string,value:unknown,readCurrent:()=>Promise<ParentHomeState>){
 const input=acknowledgeHomeInput.parse(value),home=await readCurrent();
 if(home.stage!=='READY'||!home.canOpenAccount||home.readyNoticeKey!==input.noticeKey)throw new HomeNoticeChanged('HOME_NOTICE_CHANGED');
 await pool.query('INSERT INTO family_intake.home_acknowledgements(owner_person_id,notice_key) VALUES($1,$2) ON CONFLICT(owner_person_id,notice_key) DO NOTHING',[owner,input.noticeKey]);
 return {acknowledged:true as const,noticeKey:input.noticeKey};
}
