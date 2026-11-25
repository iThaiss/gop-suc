import Link from "next/link";
import { cookies } from "next/headers";
import { ActionForm } from "../../components/admin";
import { campaigns, pendingGoods } from "../../lib/db";
import { categories, covers, money } from "../../lib/domain";
import { topics } from "../../lib/match";
import { sessionCookie, sessionRole } from "../../lib/session";

export const metadata={title:"Quản trị"};
export const dynamic="force-dynamic";
function CoverChoice({optional=false}: {optional?:boolean}) {
  const labels=["Trường học","Bếp cộng đồng","Vật tư"];
  return <select name={optional?"image":"cover"}>{optional&&<option value="">Không đính kèm ảnh</option>}{covers.map((c,i)=><option key={c} value={c}>{labels[i]}</option>)}</select>;
}
export default async function Admin({searchParams}: {searchParams:Promise<{chien?:string}>}) {
  const role=sessionRole((await cookies()).get(sessionCookie)?.value);
  if (!role) return <section className="shell narrow"><h1>Quản trị</h1><ActionForm action="login" label="Đăng nhập">
    <label>Vai trò<select name="role"><option value="organizer">Người tổ chức</option><option value="admin">Quản trị viên</option></select></label>
    <label>Mật khẩu<input name="password" type="password" required autoComplete="current-password"/></label>
    {process.env.NODE_ENV==="development" && !process.env.ADMIN_PASSWORD && !process.env.ORGANIZER_PASSWORD && <small>Demo cục bộ: gopsuc-organizer-demo hoặc gopsuc-admin-demo.</small>}
  </ActionForm></section>;
  const rows=campaigns(false).filter(c=>role==="admin"||c.owner===role);
  const picked=(await searchParams).chien;
  const selected=rows.find(c=>c.slug===picked)??rows[0];
  const status={draft:"Chờ duyệt",active:"Đang nhận",closed:"Đã đóng"};
  return <div className="shell admin"><div className="section-head"><div><h1>Quản trị chiến dịch</h1><p>{role==="admin"?"Quản trị viên":"Người tổ chức"}</p></div><ActionForm action="logout" label="Đăng xuất"/></div>
    <div className="detail-body">
      <div>
        <section className="panel"><h2>Chiến dịch</h2><div className="filters">{rows.map(c=><Link key={c.slug} aria-current={c.slug===selected?.slug?"true":undefined} href={`/quan-tri?chien=${c.slug}`}>{c.title}</Link>)}</div></section>
        {selected && <section className="panel"><h2>{selected.title}</h2><p>{status[selected.status]} · {money(selected.received)} đã nhận</p>
          {role==="admin" && selected.status!=="closed" && <ActionForm slug={selected.slug} action={selected.status==="draft"?"publish":"close"} label={selected.status==="draft"?"Duyệt và công bố":"Đóng chiến dịch"}/>}
          <h3>Hiện vật chờ bàn giao</h3>{pendingGoods(selected.slug).map(g=><article key={g.code} className="need">
            <b>{g.needName} · hẹn {g.amount} {g.unit}</b><small>Mã {g.code}</small>
            <ActionForm action="receive" slug={g.slug} label="Xác nhận đã nhận" numeric={["actual"]}><input type="hidden" name="code" value={g.code}/><label>Số thực nhận<input name="actual" type="number" min="1" max={g.amount} defaultValue={g.amount} required/></label></ActionForm>
            <ActionForm action="cancel" slug={g.slug} label="Hủy hẹn"><input type="hidden" name="code" value={g.code}/></ActionForm>
          </article>)}{!pendingGoods(selected.slug).length&&<p>Chưa có lịch hẹn bàn giao.</p>}
        </section>}
        <section className="panel"><h2>Tạo chiến dịch</h2>
          <ActionForm action="create" label="Lưu bản chờ duyệt" numeric={["goal"]}>
            <label>Tên chiến dịch<input name="title" required maxLength={100}/></label>
            <label>Mã trên URL<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={70} placeholder="vi-du-chien-dich"/></label>
            <label>Mô tả<textarea name="description" required maxLength={900}/></label>
            <label>Chủ đề<select name="category">{categories.map(c=><option key={c}>{c}</option>)}</select></label>
            <label>Khu vực<input name="location" required maxLength={60}/></label><label>Ảnh bìa<CoverChoice/></label>
            <label>Mục tiêu (₫)<input type="number" name="goal" min="1" max="1000000000" required/></label>
          </ActionForm>
        </section>
      </div>
      {selected && <aside key={selected.slug}>
        {selected.status!=="closed" && <section className="panel"><h2>Thêm nhu cầu hiện vật</h2><ActionForm action="need" slug={selected.slug} label="Thêm nhu cầu" numeric={["target"]}>
          <label>Tên hiện vật<input name="name" maxLength={100} required/></label><label>Đơn vị<input name="unit" maxLength={30} required/></label>
          <label>Số lượng cần<input name="target" type="number" min="1" max="100000" required/></label>
          <label>Nơi và giờ nhận<input name="handoff" maxLength={180} required/></label><label>Nhóm tìm kiếm<select name="topic">{topics.filter(t=>t.id!=="money").map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        </ActionForm></section>}
        <section className="panel"><h2>Đăng cập nhật</h2><ActionForm action="update" slug={selected.slug} label="Đăng bài">
          <label>Tiêu đề<input name="title" maxLength={100} required/></label><label>Nội dung<textarea name="body" maxLength={900} required/></label><label>Ảnh minh họa<CoverChoice optional/></label>
        </ActionForm></section>
        {role==="admin"&&<section className="panel"><h2>Ghi khoản chi đã duyệt</h2><ActionForm action="expense" slug={selected.slug} label="Công bố khoản chi" numeric={["amount"]}>
          <label>Hạng mục<input name="title" maxLength={100} required/></label><label>Số tiền (₫)<input name="amount" type="number" min="1" max="1000000000" required/></label><label>Mô tả chứng từ công khai<textarea name="evidence" maxLength={400} required/></label>
        </ActionForm></section>}
      </aside>}
    </div>
  </div>;
}
