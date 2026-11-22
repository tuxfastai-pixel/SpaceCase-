/** Literal, case-insensitive matching; search text is never markup or a pattern. */
export function searchParts(text:string,query:string):{text:string;match:boolean}[]{
 const terms=[...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a,b)=>b.length-a.length);
 if(!terms.length)return [{text,match:false}];
 const pattern=terms.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
 const regex=new RegExp(pattern,'giu');const parts:{text:string;match:boolean}[]=[];let end=0;
 for(const match of text.matchAll(regex)){const start=match.index!;if(start>end)parts.push({text:text.slice(end,start),match:false});parts.push({text:match[0],match:true});end=start+match[0].length;}
 if(end<text.length)parts.push({text:text.slice(end),match:false});return parts;
}
