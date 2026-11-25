import {randomUUID} from 'node:crypto';import type {PoolClient} from 'pg';
export async function communicationEvent(db:Pick<PoolClient,'query'>,account:string,kind:'ACTIVITY_OFFERED'|'CONVERSATION_MESSAGE',id:string){
 if(process.env.SPACECASE_PARENT_INBOX_ENABLED!=='true')return;
 await db.query('INSERT INTO school_comms.delivery_events(id,account_id,kind,resource_id) VALUES($1,$2,$3,$4)',[randomUUID(),account,kind,id]);
}
