import type {EngineeringHandoff} from '../../../packages/engineering-control/contracts';
import {savedTaskSchema} from '../../../packages/engineering-control/result';
export function newSaveAttempt(ticketId:string,packet:{handoff:EngineeringHandoff;digest:string},baseCommit:string,requestId:string){
 if(!/^[a-f0-9]{40}$/.test(baseCommit))throw Error('Enter the full 40-character commit SHA from the reviewed repository.');
 return {action:'SAVE_ENGINEERING_TASK' as const,ticketId,revision:packet.handoff.source.revision,brief:packet.handoff.brief,privacyReviewed:true as const,consentToStore:true as const,baseCommit,requestId};
}
export function confirmSavedTask(value:unknown,packet:{handoff:EngineeringHandoff;digest:string},baseCommit:string){
 const result=savedTaskSchema.parse(value),task=result.task;
 if(task.sourceReference!==packet.handoff.source.reference||task.sourceRevision!==packet.handoff.source.revision||task.handoffDigest!==packet.digest||task.baseCommit!==baseCommit)throw Error('The saved task could not be matched to this brief. Retry the same request to confirm it.');
 return result;
}
