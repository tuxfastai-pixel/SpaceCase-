/** A navigation selector, never an authorization token. */
export const accountKeyInput=(grantId:string)=>`family-account-navigation-v1:${grantId.toLowerCase()}`;
export async function browserAccountKey(grantId:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(accountKeyInput(grantId)));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function selectAccount(grantIds:string[],current:string,requested:string|null){
 if(grantIds.includes(current))return current;
 if(requested!==null){
  if(!/^[a-f0-9]{64}$/.test(requested))return '';
  const keys=await Promise.all(grantIds.map(browserAccountKey));
  const index=keys.indexOf(requested);return index<0?'':grantIds[index];
 }
 return grantIds[0]??'';
}
