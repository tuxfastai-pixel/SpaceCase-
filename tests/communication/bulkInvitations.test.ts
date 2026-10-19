import assert from "node:assert/strict";
import test from "node:test";
import {parseInvitationImport,reviewRecipients,invitationResultsCsv,MAX_IMPORT_SIZE} from "../../platform/invitations/bulk";

test("lists normalize addresses, default to Teacher and exclude duplicates and invalid rows",()=>{
  const rows=parseInvitationImport(" A@EXAMPLE.TEST; b@example.test, a@example.test\ninvalid ","list");
  assert.deepEqual(rows.map(r=>[r.email,r.roleCode,r.selected]),[
    ["a@example.test","TEACHER",true],["b@example.test","TEACHER",true],["a@example.test","TEACHER",false],["invalid","TEACHER",false],
  ]);
  assert.deepEqual(reviewRecipients(rows).map(r=>r.issue),[null,null,"Duplicate email","Invalid email"]);
});
test("CSV supports BOM, CRLF, quoted reordered columns and explicit administrator roles",()=>{
  const rows=parseInvitationImport('\uFEFFrole,email\r\n"School Administrator","ADMIN@example.test"\r\n,"teacher@example.test"\r\nadministrator,second@example.test',"csv");
  assert.deepEqual(rows.map(r=>[r.email,r.roleCode,r.selected]),[
    ["admin@example.test","SCHOOL_ADMINISTRATOR",true],["teacher@example.test","TEACHER",true],["second@example.test","SCHOOL_ADMINISTRATOR",true],
  ]);
  assert.equal(parseInvitationImport("email\nsolo@example.test","csv")[0].roleCode,"TEACHER");
});
test("unknown CSV roles require correction and cannot silently grant access",()=>{
  const rows=parseInvitationImport("email,role\nprincipal@example.test,PRINCIPAL\nstaff@example.test,STAFF","csv");
  assert.equal(rows.every(r=>!r.selected),true);
  assert.equal(reviewRecipients(rows)[0].issue,"Choose a supported role");
  const edited=reviewRecipients([{...rows[0],roleCode:"TEACHER",selected:true},{email:" PRINCIPAL@EXAMPLE.TEST ",roleCode:"SCHOOL_ADMINISTRATOR",selected:true}]);
  assert.equal(edited[0].issue,null);assert.equal(edited[1].issue,"Duplicate email");
});
test("malformed and ambiguous CSV is rejected before review",()=>{
  for(const source of ['email,email\na@b.test,a@b.test','name,email\nName,a@b.test','email,role\na@b.test','email\n"a@b.test','email\n"a@b.test"oops','email\na"b@c.test','email\n','']){
    assert.throws(()=>parseInvitationImport(source,"csv"),Error,source);
  }
  const escaped=parseInvitationImport('email\n"a""b@example.test"',"csv");
  assert.equal(escaped[0].email,'a"b@example.test');assert.equal(escaped[0].selected,false);
});
test("imports enforce 50-recipient and 64KB bounds",()=>{
  const emails=Array.from({length:51},(_,i)=>`person${i}@example.test`);
  assert.equal(parseInvitationImport(emails.slice(0,50).join("\n"),"list").length,50);
  assert.throws(()=>parseInvitationImport(emails.join("\n"),"list"),/50/);
  assert.throws(()=>parseInvitationImport("email\n"+emails.join("\n"),"csv"),/50/);
  assert.throws(()=>parseInvitationImport("a".repeat(MAX_IMPORT_SIZE+1),"list"),/64 KB/);
  assert.throws(()=>parseInvitationImport(" \n ","list"),/at least one/);
});
test("download pairs links with recipients and neutralizes spreadsheet formulas",()=>{
  const csv=invitationResultsCsv([{email:"=danger@example.test",roleCode:"TEACHER",link:"https://school.example/join?token=abc",expiresAt:"2026-10-26T00:00:00Z"},
    {email:"+other@example.test",roleCode:"SCHOOL_ADMINISTRATOR",link:"https://school.example/join?token=def",expiresAt:"2026-10-26T00:00:00Z"}]);
  assert.ok(csv.startsWith('\uFEFF"email","role"'));
  assert.ok(csv.includes('"\'=danger@example.test","TEACHER","https://school.example/join?token=abc"'));
  assert.ok(csv.includes('"\'+other@example.test","SCHOOL_ADMINISTRATOR","https://school.example/join?token=def"'));
  assert.equal(csv.match(/NOT_SENT/g)?.length,2);
});
