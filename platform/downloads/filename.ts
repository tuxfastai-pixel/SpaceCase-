/** Safe, descriptive CSV names shared by browser downloads and HTTP attachments. */
export function csvDownloadName({topic,school,start,end,page,exportedAt=new Date()}:{
  topic:string;school:string;start?:string;end?:string;page?:number;exportedAt?:Date;
}) {
  const slug=(value:string,limit:number)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,limit).replace(/-+$/g,'');
  const date=(value?:string)=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:undefined;
  const from=date(start),through=date(end);
  const period=from&&through?`${from}-to-${through}`:from?`from-${from}`:through?`through-${through}`:undefined;
  const stamp=exportedAt.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  return ['spacecase',slug(topic,64)||'records',slug(school,48)||'school',period,
    page&&Number.isSafeInteger(page)&&page>0?`page-${page}`:undefined,stamp].filter(Boolean).join('_')+'.csv';
}
