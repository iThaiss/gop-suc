"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, X } from "lucide-react";
import { api } from "./client";
import { PrivateReceiptLink } from "./private-receipt-link";
import { CalendarLink } from "./calendar-link";
import { requestAttempt, type Attempt } from "../lib/retry";
import { vietnamTime, type VolunteerBooking, type VolunteerShift } from "../lib/domain";

export function VolunteerShifts({items,open,initialShift}: {items:VolunteerShift[];open:boolean;initialShift?:number}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  const router=useRouter();
  const [selected,setSelected]=useState<VolunteerShift>();
  const [booking,setBooking]=useState<VolunteerBooking>();
  const [actionToken,setActionToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [stale,setStale]=useState(false);
  const pending=useRef<Attempt|null>(null);
  const opened=useRef<number|undefined>(undefined);
  useEffect(()=>{
    if(initialShift===undefined||initialShift===opened.current) return;
    opened.current=initialShift;
    const match=items.find(item=>item.id===initialShift);
    if(!open||!match||match.reserved>=match.capacity) {setStale(true);return;}
    setStale(false);setSelected(match);setBooking(undefined);setActionToken("");setError("");dialog.current?.showModal();
  },[initialShift,items,open]);
  async function book() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const data={action:"bookVolunteer",slug:selected.slug,shiftId:selected.id};
      const attempt=requestAttempt(data,pending.current);
      pending.current=attempt;
      const result=await api<{booking:VolunteerBooking;actionToken:string}>(data,undefined,attempt.key);
      if(pending.current===attempt) pending.current=null;
      setBooking(result.booking);
      setActionToken(result.actionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa đăng ký được. Vui lòng thử lại.");
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  return <section className="panel" id="tinh-nguyen">
    <h2>Góp thời gian</h2>
    {stale&&<p>Ca được gợi ý không còn nhận đăng ký. Bạn có thể chọn một ca khác nếu còn chỗ.</p>}
    <div className="volunteer-list">
      {items.map(shift=>{
        const remaining=shift.capacity-shift.reserved;
        return <article className="shift-card" key={shift.id}>
          <h3>{shift.title}</h3>
          <p><CalendarDays size={17}/><time dateTime={shift.startsAt}>{vietnamTime(shift.startsAt)}</time></p>
          <p><MapPin size={17}/>{shift.location}</p>
          <div className="shift-actions"><span>{open ? remaining>0 ? `Còn ${remaining}/${shift.capacity} chỗ` : "Đã đủ người" : "Đã ngừng đăng ký"}</span>
            {open && remaining>0 && <button type="button" className="button outline" onClick={()=>{
              if (busy) return;
              setSelected(shift);setBooking(undefined);setActionToken("");setError("");dialog.current?.showModal();
            }}>Chọn ca</button>}
          </div>
        </article>;
      })}
    </div>
    <dialog ref={dialog} className="dialog" aria-labelledby={titleId}>
      <div className="dialog-head"><h2 id={titleId}>{booking ? booking.status==="booked"?"Bạn đã giữ được chỗ":"Phiếu đã hủy giữ chỗ" : "Xác nhận ca tình nguyện"}</h2>
        <button type="button" aria-label="Đóng" className="icon" onClick={()=>dialog.current?.close()}><X/></button>
      </div>
      {selected && <div className="ticket"><strong>{selected.title}</strong><span>{vietnamTime(selected.startsAt)}</span><span>{selected.location}</span></div>}
      {booking ? <>{booking.status==="booked"&&<><CalendarLink slug={booking.slug} shiftId={booking.shiftId}/><p>Bạn có thể hủy trước giờ bắt đầu bằng liên kết riêng bên dưới.</p></>}<label>Mã tra cứu (chỉ xem)<input readOnly value={booking.code} onFocus={event=>event.currentTarget.select()}/></label>
        <PrivateReceiptLink code={booking.code} actionToken={actionToken} label="Mở phiếu tình nguyện"/></> : <button className="button" type="button" disabled={busy} onClick={()=>void book()}>{busy?"Đang giữ chỗ…":"Xác nhận giữ 1 chỗ"}</button>}
      {error && <p className="error" role="alert">{error}</p>}
    </dialog>
  </section>;
}
