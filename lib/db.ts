import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { Campaign, Need, Update, Expense, Receipt, Role } from "./domain.ts";

let connection: DatabaseSync | undefined;
const campaignFields = `c.*, COALESCE((SELECT SUM(amount) FROM receipts WHERE slug=c.slug
  AND kind='cash' AND status='confirmed'),0) AS received,
  COALESCE((SELECT SUM(amount) FROM expenses WHERE slug=c.slug),0) AS spent`;
const receiptFields = "r.code,r.slug,r.kind,r.amount,r.status,r.actual,r.needId,n.name AS needName,n.unit,n.handoff";

export function db() {
  if (connection) return connection;
  const path = process.env.DATABASE_FILE || resolve(".data/gopsuc.sqlite");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS campaigns(
      slug TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL,
      location TEXT NOT NULL, cover TEXT NOT NULL, goal INTEGER NOT NULL CHECK(goal>0),
      status TEXT NOT NULL CHECK(status IN('draft','active','closed')), owner TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS needs(
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL REFERENCES campaigns(slug), name TEXT NOT NULL,
      unit TEXT NOT NULL, target INTEGER NOT NULL CHECK(target>0), handoff TEXT NOT NULL, topic TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts(
      code TEXT PRIMARY KEY, slug TEXT NOT NULL REFERENCES campaigns(slug),
      kind TEXT NOT NULL CHECK(kind IN('cash','goods')), amount INTEGER NOT NULL CHECK(amount>0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','confirmed','cancelled')),
      actual INTEGER, needId INTEGER REFERENCES needs(id), name TEXT, note TEXT,
      created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS receipts_demo_code ON receipts(code);
    CREATE INDEX IF NOT EXISTS receipts_campaign ON receipts(slug,kind,status);
    CREATE INDEX IF NOT EXISTS receipts_need ON receipts(needId,status);
    CREATE TABLE IF NOT EXISTS expenses(
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL REFERENCES campaigns(slug), title TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount>0), evidence TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS updates(
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL REFERENCES campaigns(slug), title TEXT NOT NULL,
      body TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, role TEXT NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY);
  `);
  database.exec("BEGIN IMMEDIATE");
  try {
    if (database.prepare("INSERT OR IGNORE INTO metadata VALUES('seed-v1')").run().changes) seed(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    database.close();
    throw error;
  }
  connection = database;
  return database;
}

function seed(d: DatabaseSync) {
  const add = d.prepare("INSERT INTO campaigns VALUES(?,?,?,?,?,?,?,'active','organizer')");
  add.run("lop-hoc-sau-mua", "Góp lại lớp học sau mùa mưa", "Cùng sửa phòng học và chuẩn bị đồ dùng để một điểm trường miền núi có thể đón học sinh trở lại. Các khoản chi và mốc bàn giao được cập nhật công khai.", "Giáo dục", "Quảng Nam", "school", 60_000_000);
  add.run("bep-am-cuoi-tuan", "Bếp ấm cuối tuần", "Hỗ trợ một bếp cộng đồng chuẩn bị các phần ăn cho người đang chăm bệnh nhân. Có thể góp kinh phí hoặc gửi nguyên liệu theo danh sách.", "Thực phẩm", "Đà Nẵng", "meals", 25_000_000);
  add.run("vat-tu-sau-mua", "Vật tư cho ngày trở lại", "Góp bộ vệ sinh, chăn và chi phí vận chuyển để các gia đình sớm ổn định sinh hoạt.", "Cứu trợ", "Huế", "relief", 40_000_000);
  const need = d.prepare("INSERT INTO needs(slug,name,unit,target,handoff,topic) VALUES(?,?,?,?,?,?)");
  need.run("lop-hoc-sau-mua","Bộ dụng cụ học tập","bộ",120,"Điểm nhận demo A · Thứ bảy, 08:00–11:00","learning");
  need.run("lop-hoc-sau-mua","Bộ vệ sinh lớp học","bộ",30,"Điểm nhận demo A · Thứ bảy, 08:00–11:00","cleaning");
  need.run("bep-am-cuoi-tuan","Gạo đóng túi","kg",150,"Điểm nhận demo B · Chủ nhật, 07:00–09:00","food");
  need.run("vat-tu-sau-mua","Chăn sạch","chiếc",80,"Điểm nhận demo C · Thứ bảy, 08:00–12:00","blankets");
  const cash = d.prepare("INSERT INTO receipts(code,slug,kind,amount,status,name) VALUES(?,?,'cash',?,'confirmed',?)");
  for (const [slug, amount] of [["lop-hoc-sau-mua", 36_500_000], ["bep-am-cuoi-tuan", 12_400_000], ["vat-tu-sau-mua", 27_200_000]] as const) {
    cash.run(randomBytes(16).toString("hex"),slug,amount,"Dữ liệu mẫu");
  }
  d.prepare("INSERT INTO receipts(code,slug,kind,amount,status,actual,needId) VALUES(?,'lop-hoc-sau-mua','goods',80,'confirmed',80,1)").run(randomBytes(16).toString("hex"));
  d.prepare("INSERT INTO expenses(slug,title,amount,evidence) VALUES(?,?,?,?)").run("lop-hoc-sau-mua","Thay cửa và sửa nền hai phòng học",12_500_000,"Biên bản mô phỏng GS-001: sửa nền và thay cửa cho hai phòng học.");
  d.prepare("INSERT INTO updates(slug,title,body,image) VALUES(?,?,?,?)").run("lop-hoc-sau-mua","Đã nhận 80 bộ dụng cụ học tập","Ban tổ chức đã kiểm đếm và đóng gói 80 bộ. Điểm nhận vẫn mở vào sáng thứ bảy theo lịch đăng trên trang.", "school");
}

export const campaigns = (publicOnly = true) => db().prepare(`SELECT ${campaignFields} FROM campaigns c ${publicOnly ? "WHERE status!='draft'" : ""} ORDER BY c.rowid`).all() as unknown as Campaign[];
export const campaign = (slug: string) => db().prepare(`SELECT ${campaignFields} FROM campaigns c WHERE slug=?`).get(slug) as Campaign | undefined;
export const needs = (slug?: string) => db().prepare(`
  SELECT n.*, COALESCE(SUM(CASE WHEN r.status='confirmed' THEN r.actual ELSE 0 END),0) AS received,
  COALESCE(SUM(CASE WHEN r.status='pending' THEN r.amount ELSE 0 END),0) AS pledged
  FROM needs n JOIN campaigns c ON c.slug=n.slug LEFT JOIN receipts r ON r.needId=n.id
  WHERE ${slug ? "n.slug=?" : "c.status='active'"} GROUP BY n.id ORDER BY n.id`).all(...(slug ? [slug] : [])) as unknown as Need[];
export const updates = (slug: string) => db().prepare("SELECT * FROM updates WHERE slug=? ORDER BY id DESC").all(slug) as unknown as Update[];
export const expenses = (slug: string) => db().prepare("SELECT id,title,amount,evidence,created FROM expenses WHERE slug=? ORDER BY id DESC").all(slug) as unknown as Expense[];
export const publicGifts = (slug: string) => db().prepare("SELECT COALESCE(name,'****') AS name,amount,note FROM receipts WHERE slug=? AND kind='cash' AND status='confirmed' ORDER BY rowid DESC LIMIT 8").all(slug) as unknown as {name:string;amount:number;note:string|null}[];
export const receipt = (code: string) => db().prepare(`SELECT ${receiptFields} FROM receipts r LEFT JOIN needs n ON n.id=r.needId WHERE r.code=?`).get(code) as Receipt | undefined;
export const GOODS_PAGE_SIZE = 15;
export const pendingGoods = (slug: string, offset = 0) => db().prepare(`SELECT ${receiptFields} FROM receipts r LEFT JOIN needs n ON n.id=r.needId WHERE r.slug=? AND r.status='pending' AND r.kind='goods' ORDER BY r.rowid DESC LIMIT ? OFFSET ?`).all(slug, GOODS_PAGE_SIZE, offset) as unknown as Receipt[];
export const pendingCounts = () => new Map(db().prepare("SELECT slug, COUNT(*) AS count FROM receipts WHERE kind='goods' AND status='pending' GROUP BY slug").all().map(row => [String(row.slug), Number(row.count)]));

export class RuleError extends Error {}

function transaction<T>(action: (d: DatabaseSync) => T) {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = action(d);
    d.exec("COMMIT");
    return result;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

export function contribute(input: {slug:string;kind:"cash"|"goods";amount:number;needId?:number;name?:string;note?:string}) {
  return transaction((d) => {
    if (campaign(input.slug)?.status !== "active") throw new RuleError("Chiến dịch đã ngừng nhận đóng góp.");
    let needId: number | null = null;
    if (input.kind === "goods") {
      const need = needs(input.slug).find((item) => item.id === input.needId);
      if (!need || input.amount > need.target - need.received - need.pledged) throw new RuleError("Số lượng vượt quá phần còn có thể đăng ký.");
      needId = need.id;
    }
    const code = randomBytes(16).toString("hex");
    d.prepare("INSERT INTO receipts(code,slug,kind,amount,needId,name,note) VALUES(?,?,?,?,?,?,?)").run(code,input.slug,input.kind,input.amount,needId,input.name || null,input.note || null);
    return receipt(code)!;
  });
}

export function confirmCash(code: string) {
  return transaction((d) => {
    const previous = receipt(code);
    if (!previous || previous.kind !== "cash") throw new RuleError("Mã giao dịch không hợp lệ.");
    const change = d.prepare("UPDATE receipts SET status='confirmed', actual=amount WHERE code=? AND status='pending'").run(code);
    return { receipt: receipt(code)!, duplicate: !change.changes };
  });
}

export function manage(role: Role, slug: string, action: string, input: Record<string, string | number>) {
  return transaction((d) => {
    const c = campaign(slug);
    if (action === "create") {
      if (c) throw new RuleError("Mã chiến dịch đã tồn tại.");
      d.prepare("INSERT INTO campaigns VALUES(?,?,?,?,?,?,?,'draft',?)").run(slug,input.title,input.description,input.category,input.location,input.cover,input.goal,role);
      return;
    }
    if (!c || (role !== "admin" && c.owner !== role)) throw new RuleError("Bạn không có quyền với chiến dịch này.");
    if (action === "editDraft") {
      if (c.status !== "draft") throw new RuleError("Chỉ chỉnh sửa được chiến dịch đang chờ duyệt.");
      d.prepare("UPDATE campaigns SET title=?,description=?,category=?,location=?,cover=?,goal=? WHERE slug=?")
        .run(input.title,input.description,input.category,input.location,input.cover,input.goal,slug);
    } else if (action === "publish" || action === "close") {
      if (role !== "admin") throw new RuleError("Cần quyền quản trị.");
      if ((action === "publish" && c.status !== "draft") || (action === "close" && c.status !== "active")) throw new RuleError("Trạng thái hiện tại không cho phép thao tác này.");
      d.prepare("UPDATE campaigns SET status=? WHERE slug=?").run(action === "publish" ? "active" : "closed",slug);
    } else if (action === "need") {
      if (c.status === "closed") throw new RuleError("Chiến dịch đã đóng.");
      d.prepare("INSERT INTO needs(slug,name,unit,target,handoff,topic) VALUES(?,?,?,?,?,?)").run(slug,input.name,input.unit,input.target,input.handoff,input.topic);
    } else if (action === "update") {
      d.prepare("INSERT INTO updates(slug,title,body,image) VALUES(?,?,?,?)").run(slug,input.title,input.body,input.image);
    } else if (action === "expense") {
      if (role !== "admin") throw new RuleError("Cần quyền quản trị để ghi khoản chi đã duyệt.");
      if (Number(input.amount) > c.received - c.spent) throw new RuleError("Khoản chi vượt quá số dư.");
      d.prepare("INSERT INTO expenses(slug,title,amount,evidence) VALUES(?,?,?,?)").run(slug,input.title,input.amount,input.evidence);
    } else if (action === "receive" || action === "cancel") {
      const gift = receipt(String(input.code));
      if (!gift || gift.slug !== slug || gift.kind !== "goods" || gift.status !== "pending") throw new RuleError("Phiếu đã xử lý hoặc không hợp lệ.");
      if (action === "receive" && Number(input.actual) > gift.amount) throw new RuleError("Số thực nhận không thể vượt quá số đã hẹn.");
      d.prepare("UPDATE receipts SET status=?,actual=? WHERE code=?").run(action === "receive" ? "confirmed" : "cancelled",action === "receive" ? input.actual : null,gift.code);
    } else throw new RuleError("Thao tác không hợp lệ.");
  });
}
