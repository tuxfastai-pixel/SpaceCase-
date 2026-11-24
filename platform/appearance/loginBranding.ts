import {z} from 'zod';
import {getDatabasePool} from '../db/pool';
export const LOGIN_SCHOOL_COOKIE='spacecase_login_school';
export function loginSchool(value:unknown){const parsed=z.string().uuid().safeParse(value);return parsed.success?parsed.data.toLowerCase():null;}
/** An appearance hint only: never used for authentication or school authority. */
export async function loginBranding(value:unknown,pool:Pick<ReturnType<typeof getDatabasePool>,'query'>|null=null){const school=loginSchool(value);if(!school)return null;try{const result=await (pool??getDatabasePool()).query('SELECT b.display_name, l.jpeg FROM presentation.school_login_branding b LEFT JOIN presentation.school_logos l USING(school_id) WHERE b.school_id=$1',[school]);const row=result.rows[0];if(!row)return null;const name=z.string().trim().min(1).max(200).parse(row.display_name);return {school,name,logo:row.jpeg?`data:image/jpeg;base64,${Buffer.from(row.jpeg).toString('base64')}`:null};}catch{return null;}}
