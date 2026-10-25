import sharp from 'sharp';
import type {Pool} from 'pg';
import {FamilyDraftError} from '../../domains/family/contracts';
export async function avatar(bytes:Buffer){
 if(!bytes.length||bytes.length>2097152)throw new FamilyDraftError('INVALID_PHOTO',400);
 try{const image=sharp(bytes,{limitInputPixels:24000000,animated:false,failOn:'warning'});const m=await image.metadata();
 if(!['jpeg','png','webp'].includes(m.format??'')||(m.pages??1)>1||!m.width||!m.height||Math.min(m.width,m.height)<100)throw Error();
 const result=await image.rotate().resize(256,256,{fit:'cover',position:'centre'}).flatten({background:'white'}).jpeg({quality:80}).toBuffer();
 if(result.length>102400)throw Error();return result;
 }catch{throw new FamilyDraftError('INVALID_PHOTO',400);}
}
export async function readAvatar(pool:Pool,owner:string,child:string){const r=await pool.query('SELECT jpeg FROM family_intake.child_photos WHERE owner_person_id=$1 AND child_id=$2',[owner,child]);if(!r.rows[0])throw new FamilyDraftError('PHOTO_NOT_FOUND',404);return r.rows[0].jpeg as Buffer;}
export async function changeAvatar(pool:Pool,owner:string,child:string,revision:number,bytes:Buffer|null){
 const db=await pool.connect();try{await db.query('BEGIN');
 const locked=await db.query("SELECT revision FROM family_intake.drafts WHERE owner_person_id=$1 AND revision=$2 AND profile->'children' @> jsonb_build_array(jsonb_build_object('id',$3::text)) FOR UPDATE",[owner,revision,child]);
 if(!locked.rows[0])throw new FamilyDraftError('DRAFT_CHANGED');
 if(bytes)await db.query('INSERT INTO family_intake.child_photos(owner_person_id,child_id,jpeg) VALUES($1,$2,$3) ON CONFLICT(owner_person_id,child_id) DO UPDATE SET jpeg=EXCLUDED.jpeg,updated_at=now()',[owner,child,bytes]);
 else await db.query('DELETE FROM family_intake.child_photos WHERE owner_person_id=$1 AND child_id=$2',[owner,child]);
 const r=await db.query('UPDATE family_intake.drafts SET revision=revision+1,updated_at=now() WHERE owner_person_id=$1 AND revision<2147483647 RETURNING revision',[owner]);
 if(!r.rows[0])throw new FamilyDraftError('DRAFT_CHANGED');
 await db.query("INSERT INTO family_intake.draft_events(owner_person_id,revision,action) VALUES($1,$2,'SAVE')",[owner,r.rows[0].revision]);await db.query('COMMIT');return {revision:r.rows[0].revision};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
