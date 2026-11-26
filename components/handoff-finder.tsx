"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import type { HandoffReceipt } from "../lib/domain";
import { ActionForm } from "./admin";
import { api } from "./client";

export function HandoffActions({gift,onSaved}: {gift:HandoffReceipt;onSaved?:()=>void}) {
  if(gift.status!=="pending") return null;
  return <>
    <ActionForm action="receive" slug={gift.slug} label="Xác nhận đã nhận" numeric={["actual"]} onSaved={onSaved}>
      <input type="hidden" name="code" value={gift.code}/>
      <label>Số thực nhận<input name="actual" type="number" min="1" max={gift.amount} defaultValue={gift.amount} required/></label>
    </ActionForm>
    <details className="handoff-cancel">
      <summary>Hủy hẹn</summary>
      <p>Phiếu sẽ được đánh dấu đã hủy và số lượng hẹn trở lại phần còn nhận.</p>
      <ActionForm action="cancel" slug={gift.slug} label="Xác nhận hủy hẹn" tone="secondary" onSaved={onSaved}>
        <input type="hidden" name="code" value={gift.code}/>
      </ActionForm>
    </details>
  </>;
}

export function HandoffFinder({slug}: {slug:string}) {
  const [text,setText]=useState("");
  const [gift,setGift]=useState<HandoffReceipt>();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const current=useRef("");
  const resultHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(gift) resultHeading.current?.focus();},[gift]);
  async function query(code:string) {
    setBusy(true);
    setError("");
    setGift(undefined);
    try {
      const result=await api<{handoff:HandoffReceipt}>({action:"handoffLookup",slug,code});
      if(current.current===code) setGift(result.handoff);
    } catch(error) {
      if(current.current===code) setError(error instanceof Error?error.message:"Chưa tra cứu được phiếu.");
    } finally {
      if(current.current===code) setBusy(false);
    }
  }
  function find(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy) return;
    setGift(undefined);
    const code=text.trim().toLowerCase();
    current.current=code;
    if(!/^[a-f0-9]{32}$/.test(code)) {
      setError("Dán mã tra cứu gồm 32 ký tự. Không dùng liên kết riêng.");
      return;
    }
    void query(code);
  }
  const status=gift?.status==="confirmed"?"Đã nhận hiện vật":gift?.status==="cancelled"?"Đã hủy hẹn":"Chờ bàn giao";
  return <section className="handoff-finder" aria-label="Tìm phiếu hiện vật">
    <form className="form" onSubmit={find}>
      <label>Mã tra cứu phiếu hiện vật<input value={text} disabled={busy} required maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event=>{
        current.current="";setText(event.target.value);setGift(undefined);setError("");
      }}/></label>
      <div className="row"><button className="button outline" disabled={busy}><Search size={16} aria-hidden="true"/>{busy?"Đang tìm…":"Tìm phiếu"}</button>
        <small>Tìm theo mã trong chiến dịch này, kể cả phiếu đã xử lý.</small></div>
    </form>
    {error&&<p role="alert" className="error">{error}</p>}
    {gift&&<article className="handoff-result">
      <header><h4 ref={resultHeading} tabIndex={-1}>{gift.needName??"Phiếu hiện vật"}</h4><span className="admin-state" role="status">{status}</span></header>
      <p>Đã hẹn: <strong>{gift.amount} {gift.unit}</strong>{gift.status==="confirmed"&&<> · Thực nhận: <strong>{gift.actual} {gift.unit}</strong></>}</p>
      {gift.handoff&&<small>{gift.handoff}</small>}
      <HandoffActions key={gift.code} gift={gift} onSaved={()=>{if(current.current===gift.code) void query(gift.code);}}/>
    </article>}
  </section>;
}
