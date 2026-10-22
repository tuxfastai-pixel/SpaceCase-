import {retentionHandler} from '../../../../lib/engineering/retention';
import {getEngineeringPool} from '../../../../lib/engineering/pool';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=retentionHandler({env:()=>process.env,pool:getEngineeringPool});
