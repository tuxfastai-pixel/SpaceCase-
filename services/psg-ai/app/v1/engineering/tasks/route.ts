import {engineeringTasksHandler} from '../../../../lib/engineering/http';
import {getEngineeringPool} from '../../../../lib/engineering/pool';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=engineeringTasksHandler({env:()=>process.env,pool:getEngineeringPool,now:()=>Math.floor(Date.now()/1000)});
