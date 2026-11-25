import {createConnection} from 'node:net';
import {createHash} from 'node:crypto';
import {lstat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {z} from 'zod';
import {MAX_PROOF_BYTES,PaymentProofError} from '../../domains/school-finance/proofContracts';
export type ProofScan={hash:string;verdict:'CLEAN'|'INFECTED';engine:string;definitions:string;checkedAt:string};
export type ProofScanner={scan:(bytes:Buffer)=>Promise<ProofScan>};
const settings=z.object({socketPath:z.string().min(1).max(100).startsWith('/').refine(s=>!s.includes('\0')),timeoutMs:z.number().int().min(100).max(30000),maxDefinitionAgeHours:z.number().int().min(1).max(72)}).strict();
function frame(bytes:Buffer){const header=Buffer.alloc(4);header.writeUInt32BE(bytes.length);return Buffer.concat([header,bytes]);}
function exchange(path:string,timeout:number,command:Buffer){return new Promise<string>((resolve,reject)=>{
 const socket=createConnection({path});let response=Buffer.alloc(0),done=false;
 const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();if(error)reject(new PaymentProofError('PROOF_SCANNER_UNAVAILABLE'));else resolve(response.subarray(0,-1).toString('utf8'));};
 const timer=setTimeout(()=>finish(Error()),timeout);
 socket.on('connect',()=>socket.write(command));
 socket.on('data',part=>{response=Buffer.concat([response,part]);if(response.length>4096)return finish(Error());});
 socket.on('end',()=>{if(!response.length||response[response.length-1]!==0||response.subarray(0,-1).includes(0))finish(Error());else finish();});
 socket.on('error',()=>finish(Error()));socket.on('close',()=>{if(!done)finish(Error());});
});}
/** Local protected Unix socket only. No remote unauthenticated TCP or browser-selected destination. */
export function clamavProofScanner(configuration:z.infer<typeof settings>):ProofScanner{
 const config=settings.parse(configuration);
 return {async scan(source){const bytes=Buffer.from(source);if(!bytes.length||bytes.length>MAX_PROOF_BYTES)throw new PaymentProofError('PROOF_FILE_SIZE');
  try{const socket=await lstat(config.socketPath),directory=await lstat(dirname(config.socketPath));if(!socket.isSocket()||(socket.mode&2)!==0||!directory.isDirectory()||(directory.mode&2)!==0)throw Error();}catch{throw new PaymentProofError('PROOF_SCANNER_UNAVAILABLE');}
  const version=await exchange(config.socketPath,config.timeoutMs,Buffer.from('zVERSIONCOMMANDS\0'));
  const match=/^ClamAV ([0-9A-Za-z.+_-]{1,60})\/([0-9]{1,20})\/([^|]+)\| COMMANDS:\s*(.+)$/.exec(version);
  if(!match||!match[4].trim().split(/\s+/).includes('INSTREAM'))throw new PaymentProofError('PROOF_SCANNER_UNAVAILABLE');
  const definitionsAt=Date.parse(match[3].trim()),now=Date.now();if(!Number.isFinite(definitionsAt)||definitionsAt>now+300000||definitionsAt<now-config.maxDefinitionAgeHours*3600000)throw new PaymentProofError('PROOF_SCANNER_DEFINITIONS_STALE');
  const chunks=[Buffer.from('zINSTREAM\0')];for(let offset=0;offset<bytes.length;offset+=65536)chunks.push(frame(bytes.subarray(offset,offset+65536)));chunks.push(Buffer.alloc(4));
  const reply=await exchange(config.socketPath,config.timeoutMs,Buffer.concat(chunks));
  const verdict=reply==='stream: OK'?'CLEAN':/^stream: [^\u0000-\u001f]{1,300} FOUND$/.test(reply)?'INFECTED':null;if(!verdict)throw new PaymentProofError('PROOF_SCANNER_UNAVAILABLE');
  return {hash:createHash('sha256').update(bytes).digest('hex'),verdict,engine:`clamav-${match[1]}`,definitions:match[2],checkedAt:new Date().toISOString()};
 }};
}
