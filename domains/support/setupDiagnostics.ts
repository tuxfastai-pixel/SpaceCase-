export type SetupInput = {
 workspace: {status:string}|null;
 classes: Array<{id:string;assignedTeachers:number}>;
 connectedClassIds:string[];
 classesTruncated:boolean;
};
export type SetupSignal = {code:string;title:string;detail:string;nextAction:string};
export function schoolSetupSignals(input:SetupInput):SetupSignal[]{
 const signals:SetupSignal[]=[];
 const active=input.workspace?.status==="ACTIVE";
 if(!active)signals.push({code:"WORKSPACE",title:"School workspace needs setup",detail:"Daily school workflows require an active workspace.",nextAction:"Ask a school administrator to complete workspace setup."});
 if(!input.classes.length)signals.push({code:"CLASSES",title:"No active classes found",detail:"There are no active classes in the displayed school profile.",nextAction:"Ask a school administrator to create classes and assign teachers."});
 const unassigned=input.classes.filter(c=>c.assignedTeachers===0).length;
 if(unassigned)signals.push({code:"TEACHERS",title:"Teacher assignments needed",detail:unassigned+" displayed classes have no eligible current teacher.",nextAction:"Ask a school administrator to assign an active teacher to each class."});
 const connected=new Set(input.connectedClassIds);
 const disconnected=input.classes.filter(c=>!connected.has(c.id)).length;
 if(active&&disconnected)signals.push({code:"CONNECTIONS",title:"Class workspace connections needed",detail:disconnected+" displayed classes are not connected to an active class workspace.",nextAction:"Ask a school administrator to connect these classes in workspace setup."});
 if(input.classesTruncated)signals.push({code:"PARTIAL",title:"Setup check covers a subset",detail:"Only the first 200 active classes were supplied. Other classes have not been checked.",nextAction:"Review the remaining classes separately before treating school setup as complete."});
 return signals;
}
