"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, X } from "lucide-react";
import { api } from "./client";
import { vietnamTime, type VolunteerBooking, type VolunteerShift } from "../lib/domain";

export function VolunteerShifts({items,open}: {items:VolunteerShift[];open:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  const router=useRouter();
  const [selected,setSelected]=useState<VolunteerShift>();
  const [booking,setBooking]=useState<VolunteerBooking>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function book() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const result=await api<{booking:VolunteerBooking}>({action:"bookVolunteer",slug:selected.slug,shiftId:selected.id});
      setBooking(result.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa đăng ký được. Vui lòng thử lại.");
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  return <section className="panel" id="tinh-nguyen">
    <h2>Góp thời gian</h2>
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
              setSelected(shift);setBooking(undefined);setError("");dialog.current?.showModal();
            }}>Chọn ca</button>}
          </div>
        </article>;
      })}
    </div>
    <dialog ref={dialog} className="dialog" aria-labelledby={titleId}>
      <div className="dialog-head"><h2 id={titleId}>{booking ? "Bạn đã giữ được chỗ" : "Xác nhận ca tình nguyện"}</h2>
        <button type="button" aria-label="Đóng" className="icon" onClick={()=>dialog.current?.close()}><X/></button>
      </div>
      {selected && <div className="ticket"><strong>{selected.title}</strong><span>{vietnamTime(selected.startsAt)}</span><span>{selected.location}</span></div>}
      {booking ? <><p>Lưu mã nếu bạn cần xem lại hoặc hủy trước giờ bắt đầu.</p><label>Mã tra cứu<input readOnly value={booking.code} onFocus={event=>event.currentTarget.select()}/></label>
        <a className="button" href={`/tra-cuu?ma=${booking.code}`}>Mở phiếu tình nguyện</a></> : <button className="button" type="button" disabled={busy} onClick={()=>void book()}>{busy?"Đang giữ chỗ…":"Xác nhận giữ 1 chỗ"}</button>}
      {error && <p className="error" role="alert">{error}</p>}
    </dialog>
  </section>;
}
