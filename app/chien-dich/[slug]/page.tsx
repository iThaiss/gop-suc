import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Package } from "lucide-react";
import { Give, GiveActions, GiveNeedButton, Share } from "../../../components/client";
import { campaign, expenses, needs, publicGifts, updates } from "../../../lib/db";
import { money, picture } from "../../../lib/domain";

export const dynamic = "force-dynamic";
type Props={params:Promise<{slug:string}>;searchParams:Promise<{mon?:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const c=campaign((await params).slug);
  if (!c || c.status==="draft") return {};
  const url=`/chien-dich/${c.slug}`;
  return {title:c.title,description:c.description,alternates:{canonical:url},openGraph:{title:c.title,description:c.description,url,images:[{url:picture(c.cover),alt:c.title}]}};
}
export default async function CampaignPage({params,searchParams}:Props) {
  const c=campaign((await params).slug);
  if (!c || c.status==="draft") notFound();
  const {mon}=await searchParams;
  const items=needs(c.slug), posts=updates(c.slug), bills=expenses(c.slug), gifts=publicGifts(c.slug);
  const percent=Math.min(100,Math.floor(c.received/c.goal*100));
  return <Give campaign={{slug:c.slug,title:c.title,status:c.status}} needs={items.map(item=>({...item}))} initialNeed={typeof mon==="string" ? Number(mon)||undefined : undefined}>
    <div className="shell detail"><Link href="/#chien-dich" className="back">Tất cả chiến dịch</Link>
    <div className="detail-hero">
      <div className="detail-photo"><Image src={picture(c.cover)} alt="Ảnh minh họa chiến dịch" fill sizes="(max-width: 880px) 100vw, 58vw" preload/></div>
      <section className="detail-summary" id="gop"><div className="meta"><span>{c.category}</span><span><MapPin size={15}/>{c.location}</span></div>
        <h1>{c.title}</h1><p>{c.description}</p>
        <div className="funded"><strong>{money(c.received)}</strong><span>đã góp / {money(c.goal)}</span></div>
        <div className="detail-progress"><progress aria-label="Tiến độ tiền đã nhận" value={Math.min(c.received,c.goal)} max={c.goal}/><b>{percent}%</b></div>
        <small>Chiến dịch và giao dịch mô phỏng</small>
        {c.status==="closed" && <p>Chiến dịch đã kết thúc.</p>}
        <GiveActions/>
      </section>
    </div>
    <nav className="detail-jumps" aria-label="Các mục của chiến dịch"><a href="#hien-vat">Hiện vật</a><a href="#nhat-ky">Nhật ký</a><a href="#thu-chi">Thu chi</a></nav>
    <div className="detail-body">
      <div>
        <section className="panel" id="hien-vat"><h2>Hiện vật đang cần</h2>{items.map(n=><article key={n.id} className="need">
          <div><Package size={20}/><b>{n.name}</b></div><progress aria-label={`Tiến độ nhận ${n.name}`} value={n.received} max={n.target}/>
          <div className="need-details"><div><p><b>{n.received}/{n.target} {n.unit} đã nhận</b> · {n.pledged} {n.unit} đã hẹn · còn nhận hẹn {Math.max(0,n.target-n.received-n.pledged)} {n.unit}</p><small>{n.handoff}</small></div>
            <GiveNeedButton id={n.id} name={n.name}/></div>
        </article>)}{!items.length && <p>Chiến dịch chưa công bố nhu cầu hiện vật.</p>}</section>
        <section className="panel" id="nhat-ky"><h2>Nhật ký và ảnh bàn giao</h2>{posts.map(post=><article className="post" key={post.id} id={`cap-nhat-${post.id}`}>
          {post.image && <div className="post-photo"><Image src={picture(post.image)} alt="Ảnh minh họa cập nhật" fill sizes="(max-width: 760px) 100vw, 55vw"/></div>}
          <h3>{post.title}</h3><p>{post.body}</p><Share path={`/chien-dich/${c.slug}/cap-nhat/${post.id}`} title={post.title}/>
        </article>)}{!posts.length && <p>Chưa có cập nhật.</p>}</section>
      </div>
      <aside>
        <section className="panel" id="thu-chi"><h2>Thu chi công khai</h2><dl className="ledger"><div><dt>Đã nhận</dt><dd>{money(c.received)}</dd></div><div><dt>Đã chi</dt><dd>{money(c.spent)}</dd></div><div><dt>Còn lại</dt><dd>{money(c.received-c.spent)}</dd></div></dl>
          {bills.map(b=><details key={b.id}><summary>{b.title} · {money(b.amount)}</summary><p>{b.evidence}</p></details>)}{!bills.length && <p>Chưa có khoản chi công bố.</p>}
        </section>
        <section className="panel"><h2>Ủng hộ gần đây</h2>{gifts.map((g,i)=><article className="contributor" key={i}><div><b>{g.name}</b><strong>{money(g.amount)}</strong></div>{g.note&&<p>{g.note}</p>}</article>)}</section>
      </aside>
    </div>
  </div></Give>;
}
