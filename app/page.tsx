import Image from "next/image";
import Link from "next/link";
import { HeartHandshake, MapPin, PackageCheck, Search, Wallet } from "lucide-react";
import { GivingAssistant } from "../components/giving-assistant";
import { campaigns, needs } from "../lib/db";
import { categories, money, picture } from "../lib/domain";

export const dynamic = "force-dynamic";

function searchable(value: string) {
  return value.toLocaleLowerCase("vi").normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}

export default async function Home({searchParams}: {searchParams:Promise<{nhom?:string;q?:string}>}) {
  const params = await searchParams;
  const category = categories.find(name => name === params.nhom) ?? "";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 90) : "";
  const [rows,allNeeds] = await Promise.all([campaigns(),needs()]);
  const active = rows.filter(c => c.status === "active");
  const featured = active[0];
  const filtered = rows.filter(c => (!category || c.category === category) &&
    (!query || searchable([c.title, c.location, c.category].join(" ")).includes(searchable(query))));
  const total = rows.reduce((sum, c) => sum + c.received, 0);
  const openNeeds = allNeeds.filter(n => n.target > n.received + n.pledged);
  const filterUrl = (name: string) => {
    const search = new URLSearchParams();
    if (name) search.set("nhom", name);
    if (query) search.set("q", query);
    return (search.size ? "/?" + search : "/") + "#chien-dich";
  };

  return <div className="shell home">
    <section className="hero masthead">
      <Image className="masthead-photo" src={picture(featured?.cover ?? "school")} alt="" fill sizes="100vw" preload/>
      <div className="hero-copy">
        <span className="demo-label">Bản demo gây quỹ cộng đồng</span>
        <h1>Cùng góp sức<br/>cho <em>điều tử tế.</em></h1>
        <p>Góp tiền, hiện vật hoặc thời gian cho những việc cụ thể. Theo dõi từ lúc đóng góp đến khi bàn giao.</p>
        <div className="row"><a className="button" href="#chien-dich">Khám phá chiến dịch</a><a className="button outline" href="#tim-cach-gop">Thử trợ lý tìm cách góp</a></div>
      </div>
      {featured && <Link href={"/chien-dich/" + featured.slug} className="masthead-story">
        <span><MapPin size={15}/>{featured.location}</span><strong>{featured.title}</strong>
      </Link>}
    </section>
    <section className="impact" aria-label="Tổng quan dữ liệu demo">
      <div><Wallet size={23}/><span><strong>{money(total)}</strong><small>Đóng góp đã ghi nhận</small></span></div>
      <div><HeartHandshake size={23}/><span><strong>{active.length}</strong><small>Chiến dịch đang nhận</small></span></div>
      <div><PackageCheck size={23}/><span><strong>{openNeeds.length}</strong><small>Nhu cầu hiện vật còn mở</small></span></div>
      <span className="impact-note">Số liệu mô phỏng</span>
    </section>
    <GivingAssistant locations={[...new Set(active.map(c=>c.location))]}/>
    <section className="campaigns" id="chien-dich">
      <div className="section-head">
        <div><h2>Tìm chiến dịch</h2><p>Chọn một việc bạn muốn góp sức.</p></div>
        <form className="campaign-search" action="/#chien-dich">
          {category && <input type="hidden" name="nhom" value={category}/>}
          <input aria-label="Tên chiến dịch hoặc khu vực" name="q" type="search" defaultValue={query} placeholder="Tên chiến dịch hoặc khu vực" maxLength={90}/>
          <button className="icon" type="submit" aria-label="Tìm chiến dịch"><Search size={19}/></button>
        </form>
      </div>
      <nav className="filters discovery-filters" aria-label="Lọc theo chủ đề">{["",...categories].map(c => <Link key={c} href={filterUrl(c)} aria-current={category === c ? "true" : undefined}>{c || "Tất cả"}</Link>)}</nav>
      <div className="cards">{filtered.map(c => {
        const path = "/chien-dich/" + c.slug;
        const percent = Math.min(100, Math.floor(c.received / c.goal * 100));
        return <article className="card" key={c.slug}>
          <Link href={path} className="card-photo" aria-label={c.title}>
            <Image src={picture(c.cover)} alt="" fill sizes="(max-width: 650px) 100vw, (max-width: 950px) 50vw, 34vw"/>
            <span className="photo-category">{c.category}</span>
          </Link>
          <div className="card-content"><div className="card-place"><MapPin size={15}/>{c.location}{c.status === "closed" && <span>Đã kết thúc</span>}</div>
            <h3><Link href={path}>{c.title}</Link></h3>
            <p className="card-description">{c.description}</p>
            <div className="card-progress"><span><strong>{money(c.received)}</strong> đã góp</span><b>{percent}%</b></div>
            <progress aria-label="Tiến độ tiền đã nhận" value={Math.min(c.received,c.goal)} max={c.goal}/>
            <Link className="card-link" href={path}>{c.status === "closed" ? "Xem kết quả" : "Xem chiến dịch"}</Link>
          </div>
        </article>;
      })}</div>
      {!filtered.length && <div className="empty-campaigns"><p>Chưa tìm thấy chiến dịch phù hợp.</p><Link href="/#chien-dich">Xem tất cả chiến dịch</Link></div>}
    </section>
  </div>;
}
