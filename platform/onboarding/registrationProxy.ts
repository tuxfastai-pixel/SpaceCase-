import {peosProxy,sameOrigin} from '../admin/peosProxy';import {resolvePeosAuthorization} from '../session/peosAuthorization';import {boundedText} from '../http/boundedText';
export async function registrationProxy(request:Request,path:string){
 if(request.method==='GET')return peosProxy(request,path);
 if(!sameOrigin(request))return Response.json({error:'FORBIDDEN'},{status:403});
 if(!resolvePeosAuthorization(request))return Response.json({error:'UNAUTHENTICATED'},{status:401});
 let body:unknown;try{body=JSON.parse(await boundedText(request,8192));}catch{return Response.json({error:'INVALID_INPUT'},{status:400});}
 return peosProxy(request,path,body);
}
