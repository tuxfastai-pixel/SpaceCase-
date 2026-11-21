export class IntakeError extends Error {constructor(public code:string,public status=400){super(code);}}
export function csvCells(input:string,delimiter:string){
 if(new TextEncoder().encode(input).length>262144)throw new IntakeError('FILE_TOO_LARGE');
 const rows:string[][]=[],row:string[]=[];let cell='',quoted=false,closed=false;
 const pushCell=()=>{if(cell.length>1000)throw new IntakeError('FIELD_TOO_LONG');row.push(cell);cell='';closed=false;if(row.length>60)throw new IntakeError('TOO_MANY_COLUMNS');};
 const pushRow=()=>{pushCell();if(row.some(v=>v.trim()))rows.push([...row]);row.length=0;if(rows.length>501)throw new IntakeError('TOO_MANY_ROWS');};
 const text=input.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c===delimiter)pushCell();
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();}
  else if(c==='"'){if(cell||closed)throw new IntakeError('MALFORMED_CSV');quoted=true;}
  else {if(closed)throw new IntakeError('MALFORMED_CSV');cell+=c;}
  if(cell.length>1000)throw new IntakeError('FIELD_TOO_LONG');
 }
 if(quoted)throw new IntakeError('MALFORMED_CSV');
 if(cell||row.length||closed)pushRow();
 if(rows.length<2)throw new IntakeError('CSV_HEADER_AND_ROWS_REQUIRED');
 return rows;
}
