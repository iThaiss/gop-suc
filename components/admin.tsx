"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client";
import { UPDATE_IMAGE_MAX_BYTES } from "../lib/domain";
import { requestAttempt, type Attempt } from "../lib/retry";

export function ActionForm({ action, slug, children, label, numeric=[], tone="primary", onSaved }: {action:string;slug?:string;children?:ReactNode;label:string;numeric?:string[];tone?:"primary"|"secondary";onSaved?:()=>void}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [failed,setFailed]=useState(false);
  const pending=useRef<Attempt|null>(null);
  async function send(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setStatus("");setFailed(false);
    const form=event.currentTarget;
    const data=new FormData(form);
    const fields=Object.fromEntries([...data].filter(([,value])=>typeof value==="string").map(([name,value])=>[name,numeric.includes(name)?Number(value):String(value)]));
    try {
      const photo=data.get("photo");
      let attempt:Attempt|null=null;
      const hasPhoto=photo instanceof File&&photo.size>0;
      if(hasPhoto&&(action==="update"||action==="expense")&&photo.size>UPDATE_IMAGE_MAX_BYTES) throw new Error("Ảnh vượt quá 4 MB.");
      if(action==="expense") {
        if(hasPhoto&&data.get("publishPhoto")!=="yes") throw new Error("Xác nhận ảnh đã che thông tin riêng tư trước khi công khai.");
        const bytes=hasPhoto?Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await photo.arrayBuffer()))):null;
        attempt=requestAttempt({action,slug,fields,bytes},pending.current);
        pending.current=attempt;
      }
      if ((action==="update"||action==="expense") && photo instanceof File && photo.size) {
        data.set("action",action);
        data.set("slug",slug??"");
        await api(data,undefined,attempt?.key);
      } else await api({action,slug,...fields},undefined,attempt?.key);
      if(pending.current===attempt) pending.current=null;
      if (action!=="editDraft") form.reset();
      setStatus("Đã lưu.");
      if (action==="create") router.push("/quan-tri?chien="+encodeURIComponent(String(fields.slug)));
      else router.refresh();
      onSaved?.();
    }catch(e){setFailed(true);setStatus(e instanceof Error?e.message:"Thử lại sau.");}finally{setBusy(false);}
  }
  return <form className="form admin-form" onSubmit={send}>{children}<button className={tone==="secondary"?"button outline":"button"} disabled={busy}>{busy?"Đang lưu…":label}</button>{status&&<small role={failed?"alert":"status"} className={failed?"error":""}>{status}</small>}</form>;
}
