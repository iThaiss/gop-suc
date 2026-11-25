import Link from "next/link";
import { ArrowUpRight, CalendarClock, ClipboardCheck, Inbox, PackageCheck } from "lucide-react";
import { coordinationTasks } from "../lib/coordination";
import { vietnamTime, type Role } from "../lib/domain";

export const coordinationHref=(slug:string,tab:string,anchor:string)=>`/quan-tri?${new URLSearchParams({chien:slug,muc:tab})}#${anchor}`;

function QueueOverflow({count}: {count:number}) {
  return count>8?<p>Còn {count-8} mục. Mở chiến dịch tương ứng để xem tiếp.</p>:null;
}

export function CoordinationBoard({tasks,role}: {tasks:ReturnType<typeof coordinationTasks>;role:Role}) {
  const { handoff,shortShifts,review }=tasks;
  const handoffs=handoff.reduce((sum,item)=>sum+item.pending,0);
  return <section className="coordination-board" id="ban-dieu-phoi" aria-labelledby="coordination-title">
    <header><div><span><Inbox size={17} aria-hidden="true"/> Công việc theo chiến dịch</span><h2 id="coordination-title">Bàn điều phối</h2><p>Mở thẳng mục cần xử lý mà không phải rà từng chiến dịch.</p></div></header>
    <div className="coordination-columns">
      <section aria-labelledby="coordination-handoff"><h3 id="coordination-handoff"><PackageCheck size={18} aria-hidden="true"/> Chờ bàn giao <span>{handoffs}</span></h3>
        {handoff.length?<ul>{handoff.slice(0,8).map(({campaign,pending})=><li key={campaign.slug}>
          <Link prefetch={false} href={coordinationHref(campaign.slug,"handoff","ban-giao")}><div><b>{campaign.title}</b><small>{pending} phiếu chờ xác nhận{campaign.status==="closed"?" · Chiến dịch đã đóng":""}</small></div><ArrowUpRight size={17} aria-hidden="true"/></Link>
        </li>)}</ul>:<p>Không có phiếu chờ bàn giao.</p>}
        <QueueOverflow count={handoff.length}/>
      </section>
      <section aria-labelledby="coordination-shifts"><h3 id="coordination-shifts"><CalendarClock size={18} aria-hidden="true"/> Ca cần thêm người <span>{shortShifts.length}</span></h3>
        <p>Ca trong 48 giờ tới, còn trống ít nhất 30% số chỗ.</p>
        {shortShifts.length?<ul>{shortShifts.slice(0,8).map(({campaign,shift,open,hours})=><li key={shift.id}>
          <Link prefetch={false} href={coordinationHref(campaign.slug,"volunteer",`ca-${shift.id}`)}><div><b>{shift.title}</b><small>{campaign.title} · {vietnamTime(shift.startsAt)}</small><small>Trống {open}/{shift.capacity} chỗ · Trong {hours} giờ</small></div><ArrowUpRight size={17} aria-hidden="true"/></Link>
        </li>)}</ul>:<p>Không có ca nào cần nhắc thêm người.</p>}
        <QueueOverflow count={shortShifts.length}/>
      </section>
      <section aria-labelledby="coordination-review"><h3 id="coordination-review"><ClipboardCheck size={18} aria-hidden="true"/> Chờ duyệt <span>{review.length}</span></h3>
        {review.length?<ul>{review.slice(0,8).map(campaign=><li key={campaign.slug}>
          <Link prefetch={false} href={coordinationHref(campaign.slug,"overview","duyet")}><div><b>{campaign.title}</b><small>{role==="admin"?"Mở bản nháp để duyệt":"Xem và chỉnh sửa bản nháp"}</small></div><ArrowUpRight size={17} aria-hidden="true"/></Link>
        </li>)}</ul>:<p>Không có chiến dịch chờ duyệt.</p>}
        <QueueOverflow count={review.length}/>
      </section>
    </div>
  </section>;
}
