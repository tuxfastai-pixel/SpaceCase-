import test from 'node:test';import assert from 'node:assert/strict';import {createServer,type Socket} from 'node:net';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {clamavProofScanner} from '../../platform/evidence/clamav';
async function daemon(reply:(command:Buffer,socket:Socket)=>void,run:(socketPath:string)=>Promise<void>){const dir=await mkdtemp(join(tmpdir(),'proof-clam-')),path=join(dir,'c.sock'),sockets=new Set<Socket>();const server=createServer(socket=>{sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));let incoming=Buffer.alloc(0);socket.on('data',chunk=>{incoming=Buffer.concat([incoming,chunk]);reply(incoming,socket);});});await new Promise<void>(r=>server.listen(path,r));try{await run(path);}finally{for(const socket of sockets)socket.destroy();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}}
const version=(age=0)=>`ClamAV 1.4.3/12345/${new Date(Date.now()-age).toUTCString()} | COMMANDS: PING VERSIONCOMMANDS INSTREAM\0`;
function streamBody(command:Buffer){let offset=10;const chunks:Buffer[]=[];while(offset+4<=command.length){const size=command.readUInt32BE(offset);offset+=4;if(size===0)return Buffer.concat(chunks);if(offset+size>command.length)return null;chunks.push(command.subarray(offset,offset+size));offset+=size;}return null;}
test('ClamAV adapter sends bounded INSTREAM frames and binds the reply to the exact bytes',async()=>{
 const source=Buffer.alloc(100000,12);let scanned=false;
 await daemon((command,socket)=>{if(command.equals(Buffer.from('zVERSIONCOMMANDS\0')))socket.end(version());else if(command.subarray(0,10).equals(Buffer.from('zINSTREAM\0'))){const bytes=streamBody(command);if(bytes){scanned=true;assert.deepEqual(bytes,source);socket.end('stream: OK\0');}}},async path=>{
 const result=await clamavProofScanner({socketPath:path,timeoutMs:500,maxDefinitionAgeHours:24}).scan(source);assert.equal(result.verdict,'CLEAN');assert.equal(result.hash,createHash('sha256').update(source).digest('hex'));assert.equal(result.definitions,'12345');});assert.ok(scanned);
});
test('ClamAV detection is blocked; malformed, stale, multiple, unterminated and delayed replies fail closed',async()=>{
 for(const mode of ['infected','error','stale','multiple','unterminated','timeout'] as const)await daemon((command,socket)=>{
  if(command.equals(Buffer.from('zVERSIONCOMMANDS\0')))socket.end(version(mode==='stale'?172800000:0));else if(streamBody(command)){
   if(mode==='timeout')return;if(mode==='infected')socket.end('stream: Synthetic-Test FOUND\0');else if(mode==='multiple')socket.end('stream: OK\0stream: Synthetic-Test FOUND\0');else if(mode==='unterminated')socket.end('stream: OK');else socket.end('INSTREAM size limit exceeded ERROR\0');
  }
 },async path=>{const scanner=clamavProofScanner({socketPath:path,timeoutMs:100,maxDefinitionAgeHours:24});if(mode==='infected')assert.equal((await scanner.scan(Buffer.from('synthetic'))).verdict,'INFECTED');else await assert.rejects(scanner.scan(Buffer.from('synthetic')),/PROOF_SCANNER/);});
});
