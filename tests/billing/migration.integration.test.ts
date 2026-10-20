import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {Pool} from "pg";
test("billing migration grants safely skip an absent optional runtime role",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 try{
 const sql=await readFile("db/migrations/0009_founder_insights_billing.sql","utf8");
 const block=sql.slice(sql.indexOf("DO U&")).replaceAll("spacecase_runtime","ci_missing_billing_runtime_role");
 await pool.query(block);
 const privilege=await pool.query("SELECT has_column_privilege('spacecase_runtime','billing.invoices','amount_cents','UPDATE') AS can_edit_amount,has_table_privilege('spacecase_runtime','billing.receipts','DELETE') AS can_delete");
 assert.equal(privilege.rows[0].can_edit_amount,false);assert.equal(privilege.rows[0].can_delete,false);
 }finally{await pool.end();}
});
