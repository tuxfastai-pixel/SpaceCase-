import test from 'node:test';
import assert from 'node:assert/strict';
import {nextFlowChoice,uploadHint} from '../../app/ui/flowGuidance';
import {statementFileIssue} from '../../app/finance/presentation';
const field={visible:true,disabled:false,required:true,valid:false};
test('guidance chooses the first available required field before the submission action',()=>{
 assert.equal(nextFlowChoice([{...field,visible:false},{...field,disabled:true},field,{...field,required:false,action:true}]),2);
 assert.equal(nextFlowChoice([{...field,valid:true},{...field,required:false,action:true}]),1);
 assert.equal(nextFlowChoice([{...field,disabled:true}]),-1);
});
test('explicit learner confirmation or upload prerequisite takes priority without submitting',()=>{
 assert.equal(nextFlowChoice([field,{...field,required:false,priority:true,action:true}]),1);
 assert.equal(nextFlowChoice([field,{...field,required:false,priority:true,disabled:true}]),0);
});
test('upload guidance describes the accepted file purpose and rejects known audit exports',()=>{
 assert.match(uploadHint('.csv,text/csv'),/CSV file for this task/);
 assert.match(uploadHint('image/jpeg,image/png'),/clear photo/);
 assert.match(statementFileIssue(['Event ID','Action','Resource ID','Decision'])??'',/audit-history file/);
 assert.equal(statementFileIssue(['Date','Reference','Amount','Transaction ID']),null);
 assert.equal(statementFileIssue(['Posting Date','Details','Credit']),null);
});
