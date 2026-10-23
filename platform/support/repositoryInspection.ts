import {assertFounder,SupportError,type SupportContext} from '../../domains/support/contracts';
import {repositoryInspectionInput} from '../../packages/engineering-control/repository-contract';
import {inspectRepository,RepositoryReadError} from '../../packages/engineering-control/repository-reader';
export async function inspectFounderRepository(c:SupportContext,input:unknown,reader:typeof inspectRepository=inspectRepository){
 assertFounder(c);const parsed=repositoryInspectionInput.parse(input);
 try{return await reader(parsed);}catch(error){
  if(error instanceof RepositoryReadError)throw new SupportError(error.message,error.message==='REPOSITORY_RATE_LIMITED'?429:error.message==='REPOSITORY_CHANGED'?409:error.message==='REPOSITORY_REFERENCE_UNAVAILABLE'?404:503);
  throw new SupportError('REPOSITORY_UNAVAILABLE',503);
 }
}
