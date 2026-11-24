export const NOTICE_RETURN_COOKIE='spacecase_notice_return';
/** Only a private inbox locator, never an arbitrary next URL or authority token. */
export function noticeReturn(value:unknown){if(typeof value!=='string')return null;return /^\/parent\/inbox(?:\?(?:notice|thread)=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/.test(value)?value:null;}
export function noticeReturnCookie(value:string|null,secure:boolean){const target=noticeReturn(value);return `${NOTICE_RETURN_COOKIE}=${target?encodeURIComponent(target):''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${target?600:0}${secure?'; Secure':''}`;}
export function readNoticeReturn(value:unknown){if(typeof value!=='string')return null;try{return noticeReturn(decodeURIComponent(value));}catch{return null;}}
