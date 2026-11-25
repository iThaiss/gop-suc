import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Matcher } from "../components/client";
import { campaigns } from "../lib/db";
import { categories, money, picture } from "../lib/domain";

export const dynamic = "force-dynamic";
export default async function Home({searchParams}: {searchParams:Promise<{nhom?:string}>}) {
  const {nhom}=await searchParams;
  const rows=campaigns();
  const filtered=rows.filter(c=>!nhom || c.category===nhom);
  return <div className="shell home">
    <section className="hero">
      <div className="hero-copy">
        <span className="demo-label">Bản demo đồ án</span>
        <h1>Góp một phần.<br/>Cùng làm nên<br/><em>điều tử tế.</em></h1>
        <p>Chọn một việc bạn muốn góp sức. Theo dõi từng khoản ủng hộ, món đồ được nhận và kết quả bàn giao.</p>
        <div className="row"><a className="button" href="#chien-dich">Xem chiến dịch</a><a className="button outline" href="#tim-cach-gop">Tìm cách góp</a></div>
      </div>
      <div className="hero-photo"><Image src={picture("school")} alt="Tình nguyện viên chuẩn bị đồ dùng học tập, ảnh minh họa" fill sizes="(max-width: 760px) 100vw, 55vw" priority/></div>
    </section>
    <section className="campaigns" id="chien-dich">
      <div className="section-head"><div><h2>Chiến dịch cộng đồng</h2><p>Chọn một chiến dịch để xem những gì đang cần.</p></div>
        <nav className="filters" aria-label="Lọc theo chủ đề">{["",...categories].map(c=><Link key={c} href={c?`/?nhom=${encodeURIComponent(c)}#chien-dich`:"/#chien-dich"} aria-current={(nhom||"")===c?"true":undefined}>{c||"Tất cả"}</Link>)}</nav>
      </div>
      <div className="cards">{filtered.map(c=><article className="card" key={c.slug}>
        <Link href={`/chien-dich/${c.slug}`} className="card-photo" aria-label={c.title}><Image src={picture(c.cover)} alt="" fill sizes="(max-width: 740px) 100vw, 34vw"/></Link>
        <div className="card-content"><div className="meta"><span>{c.category}</span><span><MapPin size={14}/>{c.location}</span></div>
          <h3><Link href={`/chien-dich/${c.slug}`}>{c.title}</Link></h3>
          <progress aria-label="Tiến độ tiền đã nhận" value={Math.min(c.received,c.goal)} max={c.goal}/>
          <p><strong>{money(c.received)}</strong> / {money(c.goal)}</p>
          <Link className="card-link" href={`/chien-dich/${c.slug}`}>{c.status==="closed"?"Xem kết quả":"Xem chiến dịch"}</Link></div>
      </article>)}</div>
      {!filtered.length && <p>Chưa có chiến dịch trong nhóm này.</p>}
    </section>
    <Matcher titles={Object.fromEntries(rows.map(c=>[c.slug,c.title]))}/>
  </div>;
}
