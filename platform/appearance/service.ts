import sharp from 'sharp';
import type {Pool} from 'pg';
export class AppearanceError extends Error{constructor(public status:number,code:string){super(code);}}
export async function normalizeLogo(bytes:Buffer){
 if(!bytes.length||bytes.length>2097152)throw new AppearanceError(400,'INVALID_LOGO');
 try{const image=sharp(bytes,{limitInputPixels:16000000,animated:false,failOn:'warning'}),m=await image.metadata();if(!['jpeg','png','webp'].includes(m.format??'')||(m.pages??1)>1||!m.width||!m.height||Math.min(m.width,m.height)<64)throw Error();const out=await image.rotate().resize(512,512,{fit:'inside',withoutEnlargement:true}).flatten({background:'white'}).jpeg({quality:85}).toBuffer();if(out.length>204800)throw Error();return out;}catch{throw new AppearanceError(400,'INVALID_LOGO');}
}
export async function accountPhoto(pool:Pool,owner:string,school:string,learner:string){const r=await pool.query('SELECT p.jpeg FROM family_intake.account_photos a JOIN family_intake.child_photos p USING(owner_person_id,child_id) WHERE a.owner_person_id=$1 AND a.school_id=$2 AND a.learner_person_id=$3',[owner,school,learner]);if(!r.rows[0])throw new AppearanceError(404,'PHOTO_NOT_FOUND');return r.rows[0].jpeg as Buffer;}
export async function chooseAccountPhoto(pool:Pool,owner:string,school:string,learner:string,child:string){
 const r=await pool.query('INSERT INTO family_intake.account_photos(owner_person_id,school_id,learner_person_id,child_id) SELECT $1,$2,$3,child_id FROM family_intake.child_photos WHERE owner_person_id=$1 AND child_id=$4 ON CONFLICT(owner_person_id,school_id,learner_person_id) DO UPDATE SET child_id=EXCLUDED.child_id RETURNING child_id',[owner,school,learner,child]);if(!r.rowCount)throw new AppearanceError(404,'PHOTO_NOT_FOUND');
}
