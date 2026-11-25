import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { money, updateDate, type CampaignImpact } from "../lib/domain";

export function ReceiptImpact({impact}: {impact:CampaignImpact}) {
  const path = `/chien-dich/${impact.slug}`;
  const percent = Math.min(100,Math.floor(impact.received/impact.goal*100));
  return <section className="impact-follow" aria-labelledby="impact-follow-title">
    <div className="impact-follow-heading">
      <span>Kết quả chung · {impact.status === "closed" ? "Đã kết thúc" : "Đang nhận góp"}</span>
      <h2 id="impact-follow-title">{impact.title}</h2>
      <p>Số liệu của cả chiến dịch, không quy riêng cho phiếu này.</p>
    </div>
    <div className="impact-follow-progress">
      <div><strong>{money(impact.received)}</strong><span>/ {money(impact.goal)} mục tiêu</span></div>
      <progress value={Math.min(impact.received,impact.goal)} max={impact.goal} aria-label="Tiến độ nhận tiền của cả chiến dịch"/>
      <div><span>{percent}% mục tiêu · Đã chi {money(impact.spent)}</span><Link href={`${path}#thu-chi`}>Xem thu chi <ArrowUpRight size={16} aria-hidden="true"/></Link></div>
    </div>
    <div className="impact-follow-journal">
      <h3>Cập nhật gần đây</h3>
      {impact.updates.length ? <ul>{impact.updates.map(post=><li key={post.id}>
        <Link href={`${path}/cap-nhat/${post.id}`}><span>{post.title}</span><small>{updateDate(post.created)}</small></Link>
      </li>)}</ul> : <p>Ban tổ chức chưa đăng cập nhật.</p>}
      <Link className="button outline" href={path}>Xem chiến dịch <ArrowUpRight size={16} aria-hidden="true"/></Link>
    </div>
  </section>;
}
