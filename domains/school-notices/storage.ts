import {randomUUID} from 'node:crypto';import type {Pool,PoolClient} from 'pg';
export class NoticeError extends Error{constructor(public code:string,public status=409){super(code);}}
export async function noticeTransaction<T>(pool:Pool,run:(db:PoolClient)=>Promise<T>){const db=await pool.connect();try{await db.query('BEGIN');const out=await run(db);await db.query('COMMIT');return out;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
export function noticeFresh(d:{expiresAt:string}){const expiry=Date.parse(d.expiresAt);if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+60000)throw new NoticeError('NOTICE_FORBIDDEN',403);}
export async function noticeAudit(db:PoolClient,school:string,actor:string,action:string,id:string){await db.query('INSERT INTO school_board.audit(id,school_id,actor_person_id,action,resource_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),school,actor,action,id]);}
