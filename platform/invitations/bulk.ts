import {z} from "zod";
export const BULK_LIMIT=50;
export const MAX_IMPORT_SIZE=65_536;
export type InvitationRole="TEACHER"|"SCHOOL_ADMINISTRATOR";
export type ReviewRow={email:string;roleCode:string;selected:boolean};
export type BulkResult={email:string;roleCode:InvitationRole}&(
  | {status:"CREATED";id:string;token:string;expiresAt:string;emailStatus:"NOT_SENT"}
  | {status:"SKIPPED";reason:"INVITATION_ALREADY_PENDING"|"ALREADY_SCHOOL_MEMBER"}
  | {status:"FAILED";reason:string}
);
const emailSchema=z.string().trim().email().max(254);
export function reviewRecipients(rows:ReviewRow[]){
  const seen=new Set<string>();
  return rows.map(row=>{
    const email=row.email.trim().toLowerCase();
    const issue=!emailSchema.safeParse(email).success?"Invalid email":seen.has(email)?"Duplicate email":!["TEACHER","SCHOOL_ADMINISTRATOR"].includes(row.roleCode)?"Choose a supported role":null;
    if(emailSchema.safeParse(email).success)seen.add(email);
    return {...row,email,issue};
  });
}

/** Small, strict RFC-style CSV reader. Never evaluates spreadsheet content. */
function csvRecords(source:string):string[][]{
  const records:string[][]=[];let record:string[]=[];let field="";let quoted=false;let closed=false;
  function endField(){record.push(field);field="";closed=false;}
  function endRecord(){endField();if(record.some(value=>value.trim()))records.push(record);record=[];
    if(records.length>BULK_LIMIT+1)throw new Error(`Import up to ${BULK_LIMIT} recipients at a time.`);}
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){if(c==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c===','){endField();continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;endRecord();continue;}
    if(c==='"'){if(field.trim()||closed)throw new Error("CSV contains an unexpected quote.");field="";quoted=true;continue;}
    if(closed){if(c!==' '&&c!=='\t')throw new Error("CSV has characters after a closing quote.");continue;}
    field+=c;
  }
  if(quoted)throw new Error("CSV contains an unclosed quoted field.");
  if(field||record.length||closed)endRecord();
  return records;
}
export function parseInvitationImport(source:string,format:"list"|"csv"):ReviewRow[]{
  if(source.length>MAX_IMPORT_SIZE)throw new Error("Use a file or list smaller than 64 KB.");
  const text=source.replace(/^\uFEFF/,"");let values:Array<{email:string;roleCode:string}>;
  if(format==="list"){
    values=text.split(/[\s,;]+/).filter(Boolean).map(email=>({email,roleCode:"TEACHER"}));
  }else{
    const records=csvRecords(text);const header=records.shift()?.map(v=>v.trim().toLowerCase())??[];
    if(!header.includes("email")||new Set(header).size!==header.length||header.some(v=>v!=="email"&&v!=="role")){
      throw new Error("CSV needs an email column and an optional role column, with no other columns.");
    }
    const emailIndex=header.indexOf("email"),roleIndex=header.indexOf("role");
    values=records.map(row=>{
      if(row.length!==header.length)throw new Error("Each CSV row must have the same number of columns as its header.");
      const raw=roleIndex<0?"TEACHER":row[roleIndex].trim();
      const role=raw?raw.toUpperCase().replace(/\s+/g,"_"):"TEACHER";
      return {email:row[emailIndex],roleCode:role==="ADMINISTRATOR"?"SCHOOL_ADMINISTRATOR":role};
    });
  }
  if(!values.length)throw new Error("Add at least one email address.");
  if(values.length>BULK_LIMIT)throw new Error(`Import up to ${BULK_LIMIT} recipients at a time.`);
  return reviewRecipients(values.map(row=>({...row,selected:true}))).map(({email,roleCode,issue})=>({email,roleCode,selected:!issue}));
}
function cell(value:string){
  // Keep downloaded links/addresses as text in spreadsheet applications.
  const safe=/^[=+\-@\t\r\n]/.test(value)?`'${value}`:value;
  return `"${safe.replace(/"/g,'""')}"`;
}
export function invitationResultsCsv(rows:Array<{email:string;roleCode:string;link:string;expiresAt:string}>){
  return '\uFEFF'+[["email","role","invitation_link","expires_at","system_email_status"],...rows.map(r=>[r.email,r.roleCode,r.link,r.expiresAt,"NOT_SENT"])].map(r=>r.map(cell).join(",")).join("\r\n");
}
