import {z} from "zod";
import {csvRecords,MAX_IMPORT_SIZE} from "../invitations/bulk";
export const learnerSchema=z.object({
  admissionNumber:z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/).transform(v=>v.toUpperCase()),
  givenName:z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/).transform(v=>v.replace(/\s+/g," ")),
  familyName:z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/).transform(v=>v.replace(/\s+/g," ")),
}).strict();
export type LearnerInput=z.infer<typeof learnerSchema>;
export type LearnerReview=LearnerInput&{selected:boolean};
export function reviewLearners(rows:LearnerReview[]){
  const seen=new Set<string>();return rows.map(row=>{
    const parsed=learnerSchema.safeParse({admissionNumber:row.admissionNumber,givenName:row.givenName,familyName:row.familyName});
    const reference=row.admissionNumber.trim().toUpperCase();
    const issue=!parsed.success?"Check reference and both names":seen.has(reference)?"Duplicate learner reference":null;
    if(parsed.success)seen.add(reference);
    return {...row,...(parsed.success?parsed.data:{}),issue};
  });
}
export function parseLearnerCsv(source:string):LearnerReview[]{
  if(new TextEncoder().encode(source).length>MAX_IMPORT_SIZE)throw new Error("Use a CSV smaller than 64 KB.");
  const records=csvRecords(source.replace(/^\uFEFF/,""));const header=records.shift()?.map(s=>s.trim().toLowerCase())??[];
  const keys=["admission_number","given_name","family_name"];
  if(header.length!==3||new Set(header).size!==3||keys.some(k=>!header.includes(k)))throw new Error("CSV columns must be admission_number, given_name and family_name.");
  if(!records.length||records.length>50)throw new Error("Import between 1 and 50 learners.");
  const rows=records.map(row=>{
    if(row.length!==3)throw new Error("Each CSV row must have three columns.");
    return {admissionNumber:row[header.indexOf("admission_number")],givenName:row[header.indexOf("given_name")],familyName:row[header.indexOf("family_name")],selected:true};
  });
  return reviewLearners(rows).map(({issue,...row})=>({...row,selected:!issue}));
}
