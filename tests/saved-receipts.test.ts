import assert from "node:assert/strict";
import { test } from "node:test";
import { editSavedReceipts, readSavedReceipts, savedReceiptLimit, type SavedReceipt } from "../lib/saved-receipts.ts";

const code=(index:number)=>index.toString(16).padStart(32,"0");

test("lưu mã tra cứu, không mang khóa thao tác, tên, lời nhắn hoặc số tiền",()=>{
  const cash:SavedReceipt={code:code(1),kind:"cash"};
  const extra={...cash,actionToken:"do-not-store",name:"private",note:"private",amount:100_000};
  const edited=editSavedReceipts(null,extra,true);
  assert.deepEqual(edited,[cash]);
  assert.deepEqual(readSavedReceipts(JSON.stringify([extra,{...cash,kind:"goods"}])),[cash]);
  assert.deepEqual(readSavedReceipts(JSON.stringify([null,{code:"not a code",kind:"cash"},{code:code(2),kind:"unknown"}])),[]);
  assert.deepEqual(readSavedReceipts("invalid json"),[]);
});

test("thêm phiếu lên đầu, không ghi trùng và bỏ lưu đúng một phiếu",()=>{
  const cash:SavedReceipt={code:code(1),kind:"cash"};
  const goods:SavedReceipt={code:code(2),kind:"goods"};
  const volunteer:SavedReceipt={code:code(3),kind:"volunteer"};
  const before=JSON.stringify([goods,cash]);
  assert.deepEqual(editSavedReceipts(before,goods,true),[goods,cash]);
  assert.deepEqual(editSavedReceipts(before,volunteer,true),[volunteer,goods,cash]);
  assert.deepEqual(editSavedReceipts(before,goods,false),[cash]);
  assert.deepEqual(editSavedReceipts(before,volunteer,false),[goods,cash]);
});

test("đủ 12 phiếu thì yêu cầu bỏ lưu, không âm thầm xóa phiếu đã lưu",()=>{
  const list:SavedReceipt[]=Array.from({length:savedReceiptLimit},(_,i)=>({code:code(i),kind:"cash"}));
  const newEntry:SavedReceipt={code:code(49),kind:"goods"};
  const before=JSON.stringify(list);
  assert.throws(()=>editSavedReceipts(before,newEntry,true),/bỏ lưu một phiếu/);
  assert.deepEqual(editSavedReceipts(before,list[0],true),list);
  assert.deepEqual(readSavedReceipts(JSON.stringify([...list,newEntry])),list);
  const remaining=editSavedReceipts(before,list.at(-1)!,false);
  assert.deepEqual(editSavedReceipts(JSON.stringify(remaining),newEntry,true),[newEntry,...remaining]);
});
