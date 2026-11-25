"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./client";

export function ActionForm({ action, slug, children, label, numeric=[], tone="primary" }: {action:string;slug?:string;children?:ReactNode;label:string;numeric?:string[];tone?:"primary"|"secondary"}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [failed,setFailed]=useState(false);
  async function send(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setStatus("");setFailed(false);
    const form=event.currentTarget;
    const fields=Object.fromEntries([...new FormData(form)].map(([name,value])=>[name,numeric.includes(name)?Number(value):String(value)]));
    try {
      await api({action,slug,...fields});
      if (action!=="editDraft") form.reset();
      setStatus("Đã lưu.");
      if (action==="create") router.push("/quan-tri?chien="+encodeURIComponent(String(fields.slug)));
      else router.refresh();
    }catch(e){setFailed(true);setStatus(e instanceof Error?e.message:"Thử lại sau.");}finally{setBusy(false);}
  }
  return <form className="form admin-form" onSubmit={send}>{children}<button className={tone==="secondary"?"button outline":"button"} disabled={busy}>{busy?"Đang lưu…":label}</button>{status&&<small role={failed?"alert":"status"} className={failed?"error":""}>{status}</small>}</form>;
}
