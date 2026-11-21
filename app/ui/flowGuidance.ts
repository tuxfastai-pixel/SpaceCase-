export type FlowChoice={visible:boolean;disabled:boolean;required:boolean;valid:boolean;priority?:boolean;action?:boolean};
export function nextFlowChoice(choices:FlowChoice[]):number{
 const available=(c:FlowChoice)=>c.visible&&!c.disabled;
 const priority=choices.findIndex(c=>available(c)&&c.priority);
 if(priority>=0)return priority;
 const missing=choices.findIndex(c=>available(c)&&c.required&&!c.valid);
 return missing>=0?missing:choices.findIndex(c=>available(c)&&c.action);
}
export function uploadHint(accept:string):string{
 const types=accept.split(',').map(x=>x.trim()).filter(Boolean);
 if(types.some(x=>/csv|tsv|tab-separated/.test(x)))return 'Choose the CSV file for this task. Use its download template or the format described beside this upload.';
 if(types.length&&types.every(x=>x.startsWith('image/')))return 'Choose a clear photo in one of the supported image formats. Check that it belongs to the person or work requested here.';
 return types.length?`Choose the requested document. Accepted file types: ${types.join(', ')}.`:'Choose the file requested here. Check the upload instructions for its format and size.';
}
