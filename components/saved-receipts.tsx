"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Bookmark, BookmarkCheck, Copy } from "lucide-react";
import { receiptPath } from "../lib/receipt-access";
import { editSavedReceipts, readSavedReceipts, type SavedReceipt } from "../lib/saved-receipts";

const storageKey="gopsuc:saved-receipts:v1";
const changeEvent="gopsuc:saved-receipts:change";
const labels={cash:"Tiền mô phỏng",goods:"Hiện vật",volunteer:"Tình nguyện"};

function subscribe(notify:()=>void) {
  function onStorage(event:StorageEvent) {
    if(event.key===storageKey||event.key===null) notify();
  }
  window.addEventListener("storage",onStorage);
  window.addEventListener(changeEvent,notify);
  return ()=>{
    window.removeEventListener("storage",onStorage);
    window.removeEventListener(changeEvent,notify);
  };
}
function snapshot() {
  try {return window.localStorage.getItem(storageKey);} catch {return null;}
}
const serverSnapshot=()=>null;
function useSavedReceipts() {
  return readSavedReceipts(useSyncExternalStore(subscribe,snapshot,serverSnapshot));
}
function persist(entry:SavedReceipt,save:boolean) {
  let storage:Storage;
  let current:string|null;
  try {storage=window.localStorage;current=storage.getItem(storageKey);} catch {
    throw new Error("Trình duyệt không cho lưu phiếu. Bạn vẫn có thể sao chép mã.");
  }
  const next=editSavedReceipts(current,entry,save);
  try {
    if(next.length) storage.setItem(storageKey,JSON.stringify(next));
    else storage.removeItem(storageKey);
  } catch {
    throw new Error(save?"Chưa lưu được phiếu. Bạn vẫn có thể sao chép mã.":"Trình duyệt chưa bỏ lưu được phiếu.");
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function ReceiptCodeActions({code,kind}:SavedReceipt) {
  const saved=useSavedReceipts().some(item=>item.code===code);
  const [message,setMessage]=useState("");
  return <div className="receipt-code-actions">
    <label>Mã tra cứu (chỉ xem)<input value={code} readOnly onFocus={event=>event.currentTarget.select()}/></label>
    <div className="row">
      <button type="button" className="receipt-copy" onClick={async()=>{
        try {await navigator.clipboard.writeText(code);setMessage("Đã sao chép mã tra cứu.");}
        catch {setMessage("Chọn và sao chép mã trong ô bên trên.");}
      }}><Copy size={15} aria-hidden="true"/> Sao chép mã</button>
      <button type="button" className="receipt-copy" onClick={()=>{
        try {persist({code,kind},!saved);setMessage(saved?"Đã bỏ lưu trên trình duyệt này.":"Đã lưu trong mục Tra cứu trên trình duyệt này.");}
        catch(error) {setMessage(error instanceof Error?error.message:"Chưa lưu được phiếu.");}
      }}>{saved?<BookmarkCheck size={16} aria-hidden="true"/>:<Bookmark size={16} aria-hidden="true"/>}{saved?"Bỏ lưu phiếu":"Lưu phiếu"}</button>
    </div>
    <small>Chỉ lưu mã xem trên trình duyệt này. Không nên lưu trên máy dùng chung.</small>
    <small className="receipt-save-status" role="status">{message}</small>
  </div>;
}

export function SavedReceipts({currentCode}: {currentCode?:string}) {
  const entries=useSavedReceipts();
  const [message,setMessage]=useState("");
  const heading=useRef<HTMLHeadingElement>(null);
  return <section className="saved-receipts panel" aria-labelledby="saved-receipts-title">
    <h2 id="saved-receipts-title" tabIndex={-1} ref={heading}><Bookmark size={19} aria-hidden="true"/> Phiếu đã lưu {entries.length>0&&<small>{entries.length}</small>}</h2>
    {entries.length ? <><p>Chỉ có trên trình duyệt này. Bỏ lưu không hủy phiếu.</p>
      <ul>{entries.map(entry=>{
        const short=entry.code.slice(-6);
        return <li key={entry.code}><span><strong>{labels[entry.kind]}</strong><small>Mã cuối: {short}</small></span><div className="row">
          {entry.code===currentCode?<span className="saved-receipt-current" aria-current="true">Đang xem</span>:<a className="receipt-copy" href={receiptPath(entry.code)} aria-label={`Mở phiếu ${labels[entry.kind]} đuôi ${short}`}>Mở phiếu</a>}
          <button type="button" className="receipt-copy" aria-label={`Bỏ lưu phiếu ${labels[entry.kind]} đuôi ${short}`} onClick={()=>{
            try {persist(entry,false);setMessage("Đã bỏ lưu một phiếu trên trình duyệt này.");heading.current?.focus({preventScroll:true});}
            catch(error) {setMessage(error instanceof Error?error.message:"Chưa bỏ lưu được phiếu.");}
          }}>Bỏ lưu</button>
        </div></li>;
      })}</ul>
    </> : <p>Chưa có phiếu nào. Bấm <strong>Lưu phiếu</strong> trên phiếu để lần sau mở lại tại đây.</p>}
    <small className="receipt-save-status" role="status">{message}</small>
  </section>;
}
