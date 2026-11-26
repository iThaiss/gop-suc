"use client";

import { useState } from "react";
import { Copy, LockKeyhole } from "lucide-react";
import { receiptPath } from "../lib/receipt-access";

export function PrivateReceiptLink({code,actionToken,label}: {code:string;actionToken:string;label:string}) {
  const [status,setStatus]=useState("");
  const [manual,setManual]=useState("");
  const path=receiptPath(code,actionToken);
  return <div className="private-receipt-link">
    <div className="row"><a className="button" href={path}>{label}</a>
      <button type="button" className="button outline" onClick={async()=>{
        const link=new URL(path,window.location.origin).href;
        try {await navigator.clipboard.writeText(link);setStatus("Đã sao chép liên kết thao tác riêng.");setManual("");}
        catch {setManual(link);setStatus("Hãy chọn và sao chép liên kết bên dưới.");}
      }}><Copy size={16} aria-hidden="true"/> Sao chép liên kết riêng</button>
    </div>
    <small><LockKeyhole size={14} aria-hidden="true"/> Giữ liên kết này cho riêng bạn. Chỉ gửi mã tra cứu nếu người khác cần xem.</small>
    {manual&&<label>Liên kết riêng<input readOnly value={manual} onFocus={event=>event.currentTarget.select()}/></label>}
    {status&&<small role="status">{status}</small>}
  </div>;
}
