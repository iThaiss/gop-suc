import Link from "next/link";
import { cookies } from "next/headers";
import { ClipboardCheck, HandHeart, Package, Plus, Wallet } from "lucide-react";
import { ActionForm } from "../../components/admin";
import { campaigns, expenses, GOODS_PAGE_SIZE, needs, pendingCounts, pendingGoods, updates } from "../../lib/db";
import { categories, covers, money, type Campaign } from "../../lib/domain";
import { topics } from "../../lib/match";
import { sessionCookie, sessionRole } from "../../lib/session";

export const metadata={title:"Quản trị"};
export const dynamic="force-dynamic";

const status={draft:"Chờ duyệt",active:"Đang nhận",closed:"Đã đóng"};
const tabs={overview:"Tổng quan",handoff:"Bàn giao",journal:"Nhật ký & thu chi"} as const;
type Tab=keyof typeof tabs;

function adminPath(slug: string, tab: Tab = "overview", page = 1) {
  return "/quan-tri?" + new URLSearchParams({chien:slug, muc:tab, ...(page>1?{trang:String(page)}:{})});
}

function CoverChoice({optional=false, value}: {optional?:boolean;value?:string}) {
  const labels=["Trường học","Bếp cộng đồng","Vật tư"];
  return <select name={optional?"image":"cover"} defaultValue={value}>{optional&&<option value="">Không đính kèm ảnh</option>}{covers.map((c,i)=><option key={c} value={c}>{labels[i]}</option>)}</select>;
}

function CampaignFields({campaign}: {campaign?:Campaign}) {
  return <>
    <label>Tên chiến dịch<input name="title" required maxLength={100} defaultValue={campaign?.title}/></label>
    {!campaign && <label>Mã trên URL<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={70} placeholder="vi-du-chien-dich"/></label>}
    <label>Mô tả<textarea name="description" required maxLength={900} defaultValue={campaign?.description}/></label>
    <div className="admin-fields">
      <label>Chủ đề<select name="category" defaultValue={campaign?.category}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Khu vực<input name="location" required maxLength={60} defaultValue={campaign?.location}/></label>
      <label>Ảnh bìa<CoverChoice value={campaign?.cover}/></label>
      <label>Mục tiêu (₫)<input type="number" name="goal" min="1" max="1000000000" required defaultValue={campaign?.goal}/></label>
    </div>
  </>;
}

export default async function Admin({searchParams}: {searchParams:Promise<{chien?:string;muc?:string;trang?:string}>}) {
  const role=sessionRole((await cookies()).get(sessionCookie)?.value);
  if (!role) return <section className="shell narrow"><h1>Quản trị</h1><ActionForm action="login" label="Đăng nhập">
    <label>Vai trò<select name="role"><option value="organizer">Người tổ chức</option><option value="admin">Quản trị viên</option></select></label>
    <label>Mật khẩu<input name="password" type="password" required autoComplete="current-password"/></label>
    {process.env.NODE_ENV==="development" && !process.env.ADMIN_PASSWORD && !process.env.ORGANIZER_PASSWORD && <small>Demo cục bộ: gopsuc-organizer-demo hoặc gopsuc-admin-demo.</small>}
  </ActionForm></section>;

  const params=await searchParams;
  const rows=campaigns(false).filter(c=>role==="admin"||c.owner===role);
  const selected=rows.find(c=>c.slug===params.chien)??rows[0];
  const tab=(Object.keys(tabs) as Tab[]).find(key=>key===params.muc)??"overview";
  const counts=pendingCounts();
  const queued=rows.reduce((total,c)=>total+(counts.get(c.slug)??0),0);
  const count=selected ? counts.get(selected.slug)??0 : 0;
  const pages=Math.max(1,Math.ceil(count/GOODS_PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Math.floor(Number(params.trang)||1)));
  const queue=selected&&tab==="handoff" ? pendingGoods(selected.slug,(page-1)*GOODS_PAGE_SIZE) : [];
  const items=selected && tab==="overview" ? needs(selected.slug) : [];
  const posts=selected && tab==="journal" ? updates(selected.slug) : [];
  const bills=selected && tab==="journal" ? expenses(selected.slug) : [];

  return <div className="shell admin">
    <div className="section-head"><div><h1>Quản trị chiến dịch</h1><p>{role==="admin"?"Quản trị viên":"Người tổ chức"}</p></div><ActionForm action="logout" label="Đăng xuất" tone="secondary"/></div>
    <div className="admin-stats" aria-label="Tổng quan chiến dịch">
      <div><HandHeart size={23}/><span><strong>{rows.filter(c=>c.status==="active").length}</strong>Đang nhận góp</span></div>
      <div><ClipboardCheck size={23}/><span><strong>{rows.filter(c=>c.status==="draft").length}</strong>Chờ duyệt</span></div>
      <div><Package size={23}/><span><strong>{queued}</strong>Phiếu chờ bàn giao</span></div>
    </div>
    <div className="admin-grid">
      <aside className="panel admin-sidebar">
        <h2>Chiến dịch của bạn</h2>
        <nav aria-label="Chọn chiến dịch">{rows.map(c=><Link key={c.slug} aria-current={c.slug===selected?.slug?"page":undefined} href={adminPath(c.slug)}>
          <strong>{c.title}</strong><span>{status[c.status]}{(counts.get(c.slug)??0)>0 && (" · "+counts.get(c.slug)+" phiếu hẹn")}</span>
        </Link>)}</nav>
        <details className="admin-disclosure"><summary><Plus size={18}/> Tạo chiến dịch</summary>
          <ActionForm action="create" label="Lưu bản chờ duyệt" numeric={["goal"]}><CampaignFields/></ActionForm>
        </details>
      </aside>
      {selected && <section className="panel admin-workspace" key={selected.slug}>
        <div className="admin-campaign-head">
          <div><span className={"admin-state "+selected.status}>{status[selected.status]}</span><h2>{selected.title}</h2><p>{selected.location} · {selected.category}</p></div>
          {selected.status!=="draft"&&<Link className="button outline" href={"/chien-dich/"+selected.slug}>Xem trang chiến dịch</Link>}
        </div>
        <nav className="filters admin-tabs" aria-label="Nghiệp vụ chiến dịch">{(Object.keys(tabs) as Tab[]).map(key=><Link key={key} aria-current={key===tab?"true":undefined} href={adminPath(selected.slug,key)}>{tabs[key]}{key==="handoff" && count>0 ? " ("+count+")" : ""}</Link>)}</nav>
        {tab==="overview" && <>
          <div className="admin-money"><Wallet size={20}/><dl className="ledger"><div><dt>Đã nhận</dt><dd>{money(selected.received)}</dd></div><div><dt>Đã chi</dt><dd>{money(selected.spent)}</dd></div><div><dt>Còn lại</dt><dd>{money(selected.received-selected.spent)}</dd></div></dl></div>
          <p>{selected.description}</p>
          {selected.status==="draft" && <details className="admin-disclosure"><summary>Chỉnh sửa bản chờ duyệt</summary>
            <ActionForm action="editDraft" slug={selected.slug} label="Lưu thay đổi" numeric={["goal"]}><CampaignFields campaign={selected}/></ActionForm>
          </details>}
          {role==="admin" && selected.status==="draft" && <ActionForm slug={selected.slug} action="publish" label="Duyệt và công bố"/>}
          {role==="admin" && selected.status==="active" && <details className="admin-disclosure"><summary>Đóng chiến dịch</summary><p>Trang kết quả vẫn xem được. Chiến dịch sẽ ngừng nhận khoản góp mới.</p><ActionForm slug={selected.slug} action="close" label="Xác nhận đóng" tone="secondary"/></details>}
          <h3>Nhu cầu hiện vật</h3>
          {items.length ? <ul className="admin-need-list">{items.map(item=><li key={item.id}><b>{item.name}</b><span>{item.received}/{item.target} {item.unit} đã nhận · {item.pledged} đã hẹn</span></li>)}</ul> : <p>Chưa có nhu cầu.</p>}
          {selected.status!=="closed"&&<details className="admin-disclosure"><summary><Plus size={18}/> Thêm nhu cầu</summary>
            <ActionForm action="need" slug={selected.slug} label="Thêm nhu cầu" numeric={["target"]}>
              <label>Tên hiện vật<input name="name" maxLength={100} required/></label><div className="admin-fields"><label>Đơn vị<input name="unit" maxLength={30} required/></label><label>Số lượng cần<input name="target" type="number" min="1" max="100000" required/></label></div>
              <label>Nơi và giờ nhận<input name="handoff" maxLength={180} required/></label><label>Nhóm tìm kiếm<select name="topic">{topics.filter(t=>t.id!=="money").map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            </ActionForm>
          </details>}
        </>}
        {tab==="handoff" && <>
          <h3>Hiện vật chờ bàn giao</h3>{queue.map(g=><details className="admin-disclosure" key={g.code}>
            <summary>{g.needName} · hẹn {g.amount} {g.unit}</summary><p>{g.handoff}</p><small>Mã <code>{g.code}</code></small>
            <ActionForm action="receive" slug={g.slug} label="Xác nhận đã nhận" numeric={["actual"]}><input type="hidden" name="code" value={g.code}/><label>Số thực nhận<input name="actual" type="number" min="1" max={g.amount} defaultValue={g.amount} required/></label></ActionForm>
            <ActionForm action="cancel" slug={g.slug} label="Hủy hẹn" tone="secondary"><input type="hidden" name="code" value={g.code}/></ActionForm>
          </details>)}{!queue.length&&<p>Chưa có lịch hẹn bàn giao.</p>}
          {pages>1&&<nav className="filters admin-pages" aria-label="Các trang phiếu bàn giao">
            {page>1&&<Link href={adminPath(selected.slug,tab,page-1)}>Trang trước</Link>} <span>Trang {page}/{pages}</span> {page<pages&&<Link href={adminPath(selected.slug,tab,page+1)}>Trang sau</Link>}
          </nav>}
        </>}
        {tab==="journal" && <>
          <h3>Nhật ký</h3>{posts.length ? <ul className="admin-need-list">{posts.map(post=><li key={post.id}><b>{post.title}</b><span>{post.created.slice(0,10)}</span></li>)}</ul> : <p>Chưa có bài cập nhật.</p>}
          <details className="admin-disclosure"><summary><Plus size={18}/> Đăng cập nhật</summary>
            <ActionForm action="update" slug={selected.slug} label="Đăng bài">
              <label>Tiêu đề<input name="title" maxLength={100} required/></label><label>Nội dung<textarea name="body" maxLength={900} required/></label><label>Ảnh minh họa<CoverChoice optional/></label>
            </ActionForm>
          </details>
          <h3>Khoản chi đã công bố</h3>{bills.length ? <ul className="admin-need-list">{bills.map(bill=><li key={bill.id}><b>{bill.title}</b><span>{money(bill.amount)}</span></li>)}</ul> : <p>Chưa có khoản chi.</p>}
          {role==="admin"&&<details className="admin-disclosure"><summary><Plus size={18}/> Ghi khoản chi đã duyệt</summary>
            <ActionForm action="expense" slug={selected.slug} label="Công bố khoản chi" numeric={["amount"]}>
              <label>Hạng mục<input name="title" maxLength={100} required/></label><label>Số tiền (₫)<input name="amount" type="number" min="1" max="1000000000" required/></label><label>Mô tả chứng từ công khai<textarea name="evidence" maxLength={400} required/></label>
            </ActionForm>
          </details>}
        </>}
      </section>}
    </div>
  </div>;
}
