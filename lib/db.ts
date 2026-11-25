import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { postgresConfig } from "./postgres-config.ts";
import type { Campaign, CampaignImpact, Need, Update, Expense, Receipt, Role, VolunteerShift, VolunteerBooking } from "./domain.ts";

let connection: DatabaseSync | undefined;
const campaignFields = `c.*, COALESCE((SELECT SUM(amount) FROM receipts WHERE slug=c.slug
  AND kind='cash' AND status='confirmed'),0) AS received,
  COALESCE((SELECT SUM(amount) FROM expenses WHERE slug=c.slug),0) AS spent`;
const receiptFields = "r.code,r.slug,r.kind,r.amount,r.status,r.actual,r.needId,n.name AS needName,n.unit,n.handoff";

function sqlite() {
  if (process.env.VERCEL==="1") throw new Error("DATABASE_URL is required on Vercel.");
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
    CREATE TABLE IF NOT EXISTS expense_photos(
      expense_id INTEGER PRIMARY KEY REFERENCES expenses(id) ON DELETE CASCADE,
      image BLOB NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64),
      is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0,1)));
    CREATE TABLE IF NOT EXISTS updates(
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL REFERENCES campaigns(slug), title TEXT NOT NULL,
      body TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS update_photos(
      updateId INTEGER PRIMARY KEY REFERENCES updates(id) ON DELETE CASCADE, image BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS volunteer_shifts(
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL REFERENCES campaigns(slug), title TEXT NOT NULL,
      location TEXT NOT NULL, startsAt TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0));
    CREATE TABLE IF NOT EXISTS volunteer_bookings(
      code TEXT PRIMARY KEY, shiftId INTEGER NOT NULL REFERENCES volunteer_shifts(id),
      status TEXT NOT NULL CHECK(status IN ('booked','cancelled')));
    CREATE INDEX IF NOT EXISTS volunteer_bookings_shift ON volunteer_bookings(shiftId,status);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, role TEXT NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY);
  `);
  database.exec("BEGIN IMMEDIATE");
  try {
    if (database.prepare("INSERT OR IGNORE INTO metadata VALUES('seed-v1')").run().changes) seed(database);
    if (database.prepare("INSERT OR IGNORE INTO metadata VALUES('receipt-action-access-v1')").run().changes) {
      database.exec("ALTER TABLE receipts ADD COLUMN action_hash TEXT; ALTER TABLE volunteer_bookings ADD COLUMN action_hash TEXT;");
    }
    if (database.prepare("INSERT OR IGNORE INTO metadata VALUES('volunteer-demo-v1')").run().changes) {
      const start = new Date(Date.now()+7*24*3600_000);
      start.setUTCHours(2,0,0,0);
      database.prepare("INSERT INTO volunteer_shifts(slug,title,location,startsAt,capacity) SELECT slug,?,?,?,? FROM campaigns WHERE slug='lop-hoc-sau-mua'")
        .run("Đóng gói đồ dùng học tập","Điểm nhận demo A",start.toISOString(),8);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    database.close();
    throw error;
  }
  connection = database;
  return database;
}

type Value = string | number | Uint8Array | null;
type Row = Record<string, unknown>;
type Executor = (sql:string,values:Value[])=>Promise<Row[]>;
const transactionContext = new AsyncLocalStorage<Executor>();
let pool: pg.Pool | undefined;
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work:()=>Promise<T>):Promise<T> {
  const next=queue.then(work,work);
  queue=next.catch(()=>undefined);
  return next;
}

const sqliteExecute:Executor = async (sql,values) => {
  const stmt=sqlite().prepare(sql);
  if (/^\s*(select|with)\b|\breturning\b/i.test(sql)) return stmt.all(...values);
  stmt.run(...values);
  return [];
};

function pgPool() {
  if (!pool) {
    pool=new pg.Pool({...postgresConfig(process.env.DATABASE_URL!),max:3,idleTimeoutMillis:15000});
    pool.on("error",()=>console.error("Góp Sức database pool connection was interrupted."));
  }
  return pool;
}

function postgres(peer: Pick<pg.PoolClient,"query">):Executor {
  return async (sql,values) => {
    let bind=0;
    const statement=sql.replace(/\?/g,()=>"$"+ ++bind)
      .replace(/c\.rowid/g,"c.position").replace(/\b(r\.)?rowid\b/g,"$1sequence")
      .replace(/\b(FROM|JOIN|INTO|UPDATE) (campaigns|needs|receipts|expenses|expense_photos|updates|update_photos|volunteer_shifts|volunteer_bookings|sessions|limits)\b/gi,"$1 gopsuc.$2");
    const {rows}=await peer.query(statement,values.map(v=>v instanceof Uint8Array ? Buffer.from(v) : v));
    return rows.map(row=>{
      const columns: Record<string,string>={needid:"needId",needname:"needName",hasphoto:"hasPhoto",startsat:"startsAt"};
      return Object.fromEntries(Object.entries(row).map(([key,value])=>[
        columns[key]??key, ["received","spent","pledged","count","reserved","hasphoto"].includes(key)?Number(value):value,
      ]));
    });
  };
}

export async function all<T = Row>(sql:string,...values:Value[]):Promise<T[]> {
  const active=transactionContext.getStore();
  if (active) return await active(sql,values) as T[];
  if (process.env.DATABASE_URL) return await postgres(pgPool())(sql,values) as T[];
  return await serialize(()=>sqliteExecute(sql,values)) as T[];
}

export async function get<T = Row>(sql:string,...values:Value[]):Promise<T | undefined> {
  return (await all<T>(sql,...values))[0];
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

export const campaigns = (publicOnly = true) => all<Campaign>(`SELECT ${campaignFields} FROM campaigns c ${publicOnly ? "WHERE status!='draft'" : ""} ORDER BY c.rowid`)
export const campaign = (slug: string) => get<Campaign>(`SELECT ${campaignFields} FROM campaigns c WHERE slug=?`,slug)
export async function campaignImpact(slug: string): Promise<CampaignImpact | null> {
  const row = await campaign(slug);
  if (!row || row.status === "draft") return null;
  const {title,status,received,spent,goal}=row;
  const recent = await all<CampaignImpact["updates"][number]>("SELECT id,title,created FROM updates WHERE slug=? ORDER BY id DESC LIMIT 2",slug);
  return {slug,title,status,received,spent,goal,updates:recent};
}
export const needs = (slug?: string) => all<Need>(`
  SELECT n.*, COALESCE(SUM(CASE WHEN r.status='confirmed' THEN r.actual ELSE 0 END),0) AS received,
  COALESCE(SUM(CASE WHEN r.status='pending' THEN r.amount ELSE 0 END),0) AS pledged
  FROM needs n JOIN campaigns c ON c.slug=n.slug LEFT JOIN receipts r ON r.needId=n.id
  WHERE ${slug ? "n.slug=?" : "c.status='active'"} GROUP BY n.id ORDER BY n.id`,...(slug ? [slug] : []))
export const updates = (slug: string) => all<Update>("SELECT u.*,EXISTS(SELECT 1 FROM update_photos p WHERE p.updateId=u.id) AS hasPhoto FROM updates u WHERE slug=? ORDER BY id DESC",slug)
export const publicUpdatePhoto = async (slug: string, id: number) => (await get<{image:Uint8Array}>(`
  SELECT p.image FROM update_photos p JOIN updates u ON u.id=p.updateId JOIN campaigns c ON c.slug=u.slug
  WHERE u.slug=? AND u.id=? AND c.status!='draft'
`,slug,id))?.image;
export const expenses = (slug: string) => all<Expense>(`
  SELECT e.id,e.title,e.amount,e.evidence,e.created,CASE WHEN p.is_public=1 THEN p.sha256 ELSE NULL END AS photo_sha,
    CASE WHEN p.is_public=0 THEN 1 ELSE 0 END AS photo_hidden
  FROM expenses e LEFT JOIN expense_photos p ON p.expense_id=e.id WHERE e.slug=? ORDER BY e.id DESC
`,slug);
export const publicExpensePhoto = (slug:string,id:number) => get<{image:Uint8Array;sha256:string}>(`
  SELECT p.image,p.sha256 FROM expense_photos p JOIN expenses e ON e.id=p.expense_id JOIN campaigns c ON c.slug=e.slug
  WHERE e.slug=? AND e.id=? AND p.is_public=1 AND c.status!='draft'
`,slug,id);
export const publicGifts = (slug: string) => all<{name:string;amount:number;note:string|null}>("SELECT COALESCE(name,'****') AS name,amount,note FROM receipts WHERE slug=? AND kind='cash' AND status='confirmed' ORDER BY rowid DESC LIMIT 8",slug)
export const receipt = (code: string) => get<Receipt>(`SELECT ${receiptFields} FROM receipts r LEFT JOIN needs n ON n.id=r.needId WHERE r.code=?`,code)
export const GOODS_PAGE_SIZE = 15;
export const pendingGoods = (slug: string, offset = 0) => all<Receipt>(`SELECT ${receiptFields} FROM receipts r LEFT JOIN needs n ON n.id=r.needId WHERE r.slug=? AND r.status='pending' AND r.kind='goods' ORDER BY r.rowid DESC LIMIT ? OFFSET ?`,slug, GOODS_PAGE_SIZE, offset)
export const pendingCounts = async () => new Map((await all<{slug:string;count:number}>("SELECT slug, COUNT(*) AS count FROM receipts WHERE kind='goods' AND status='pending' GROUP BY slug")).map(row => [row.slug,row.count]));
export const volunteerShifts = (slug: string) => all<VolunteerShift>(`
  SELECT s.*, (SELECT COUNT(*) FROM volunteer_bookings b WHERE b.shiftId=s.id AND b.status='booked') AS reserved
  FROM volunteer_shifts s WHERE s.slug=? ORDER BY s.startsAt,s.id
`,slug)
export const volunteerBooking = (code: string) => get<VolunteerBooking>(`
  SELECT b.code,s.slug,s.title,s.location,s.startsAt,b.status
  FROM volunteer_bookings b JOIN volunteer_shifts s ON s.id=b.shiftId WHERE b.code=?
`,code)
export class RuleError extends Error {}
export class ReceiptAccessError extends Error {
  constructor(){super("Bạn cần mở liên kết thao tác riêng của phiếu này.");}
}

const actionDigest = (value: string) => createHash("sha256").update(value).digest();
function requireReceiptAccess(stored: string | null | undefined, token: string | undefined) {
  if (!stored || !/^[a-f0-9]{64}$/.test(stored) || !token || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(stored,"hex"),actionDigest(token))) {
    throw new ReceiptAccessError();
  }
}

export async function transaction<T>(action:()=>Promise<T>):Promise<T> {
  if (transactionContext.getStore()) return action();
  if (process.env.DATABASE_URL) {
    const peer=await pgPool().connect();
    try {
      await peer.query("BEGIN");
      await peer.query("SELECT pg_advisory_xact_lock(42870519)");
      const result=await transactionContext.run(postgres(peer),action);
      await peer.query("COMMIT");
      return result;
    } catch (error) {
      await peer.query("ROLLBACK").catch(()=>undefined);
      throw error;
    } finally {
      peer.release();
    }
  }
  return serialize(async ()=>{
    const d=sqlite();
    d.exec("BEGIN IMMEDIATE");
    try {
      const result=await transactionContext.run(sqliteExecute,action);
      d.exec("COMMIT");
      return result;
    } catch(error) {
      d.exec("ROLLBACK");
      throw error;
    }
  });
}

export function contribute(input: {slug:string;kind:"cash"|"goods";amount:number;needId?:number;name?:string;note?:string}) {
  return transaction(async ()=>{
    if ((await campaign(input.slug))?.status !== "active") throw new RuleError("Chiến dịch đã ngừng nhận đóng góp.");
    let needId: number | null = null;
    if (input.kind === "goods") {
      const need = (await needs(input.slug)).find((item) => item.id === input.needId);
      if (!need || input.amount > need.target - need.received - need.pledged) throw new RuleError("Số lượng vượt quá phần còn có thể đăng ký.");
      needId = need.id;
    }
    const code = randomBytes(16).toString("hex");
    const actionToken = input.kind === "cash" ? randomBytes(32).toString("hex") : null;
    await all("INSERT INTO receipts(code,slug,kind,amount,needId,name,note,action_hash) VALUES(?,?,?,?,?,?,?,?)",code,input.slug,input.kind,input.amount,needId,input.name || null,input.note || null,actionToken ? actionDigest(actionToken).toString("hex") : null);
    return {gift:(await receipt(code))!,actionToken};
  });
}

export function confirmCash(code: string, actionToken?: string) {
  return transaction(async ()=>{
    requireReceiptAccess((await get<{action_hash:string|null}>("SELECT action_hash FROM receipts WHERE code=? AND kind='cash'",code))?.action_hash,actionToken);
    const change = await get("UPDATE receipts SET status='confirmed', actual=amount WHERE code=? AND status='pending' RETURNING code",code);
    return { receipt: (await receipt(code))!, duplicate: !change };
  });
}

export function bookVolunteer(slug: string, id: number) {
  return transaction(async ()=>{
    if ((await campaign(slug))?.status!=="active") throw new RuleError("Chiến dịch đã ngừng nhận đăng ký.");
    const shift=(await volunteerShifts(slug)).find(row=>row.id===id);
    if (!shift || Date.parse(shift.startsAt)<=Date.now()) throw new RuleError("Ca này đã qua hoặc không còn mở.");
    if (shift.reserved>=shift.capacity) throw new RuleError("Ca này đã đủ người.");
    const code=randomBytes(16).toString("hex");
    const actionToken=randomBytes(32).toString("hex");
    await all("INSERT INTO volunteer_bookings(code,shiftId,status,action_hash) VALUES(?,?,'booked',?)",code,id,actionDigest(actionToken).toString("hex"));
    return {booking:(await volunteerBooking(code))!,actionToken};
  });
}

export function cancelVolunteer(code: string, actionToken?: string) {
  return transaction(async ()=>{
    requireReceiptAccess((await get<{action_hash:string|null}>("SELECT action_hash FROM volunteer_bookings WHERE code=?",code))?.action_hash,actionToken);
    const booking=(await volunteerBooking(code))!;
    if (booking.status==="cancelled") return booking;
    if (Date.parse(booking.startsAt)<=Date.now()) throw new RuleError("Ca đã bắt đầu và không thể hủy.");
    await all("UPDATE volunteer_bookings SET status='cancelled' WHERE code=?",code);
    return (await volunteerBooking(code))!;
  });
}

export function manage(role: Role, slug: string, action: string, input: Record<string, string | number>, photo?: Uint8Array) {
  return transaction(async ()=>{
    const c = await campaign(slug);
    if (action === "create") {
      if (c) throw new RuleError("Mã chiến dịch đã tồn tại.");
      await all("INSERT INTO campaigns(slug,title,description,category,location,cover,goal,status,owner) VALUES(?,?,?,?,?,?,?,'draft',?)",slug,input.title,input.description,input.category,input.location,input.cover,input.goal,role);
      return;
    }
    if (!c || (role !== "admin" && c.owner !== role)) throw new RuleError("Bạn không có quyền với chiến dịch này.");
    if (action === "editDraft") {
      if (c.status !== "draft") throw new RuleError("Chỉ chỉnh sửa được chiến dịch đang chờ duyệt.");
      await all("UPDATE campaigns SET title=?,description=?,category=?,location=?,cover=?,goal=? WHERE slug=?",input.title,input.description,input.category,input.location,input.cover,input.goal,slug);
    } else if (action === "publish" || action === "close") {
      if (role !== "admin") throw new RuleError("Cần quyền quản trị.");
      if ((action === "publish" && c.status !== "draft") || (action === "close" && c.status !== "active")) throw new RuleError("Trạng thái hiện tại không cho phép thao tác này.");
      await all("UPDATE campaigns SET status=? WHERE slug=?",action === "publish" ? "active" : "closed",slug);
    } else if (action==="addShift") {
      const date=String(input.startLocal);
      const start=new Date(date+":00+07:00");
      const local=Number.isFinite(start.getTime()) ? new Date(start.getTime()+7*3600_000).toISOString().slice(0,16) : "";
      if (c.status==="closed" || local!==date || start.getTime()<=Date.now()) throw new RuleError("Chọn thời gian ca trong tương lai.");
      await all("INSERT INTO volunteer_shifts(slug,title,location,startsAt,capacity) VALUES(?,?,?,?,?)",slug,input.title,input.location,start.toISOString(),input.capacity);
    } else if (action === "need") {
      if (c.status === "closed") throw new RuleError("Chiến dịch đã đóng.");
      await all("INSERT INTO needs(slug,name,unit,target,handoff,topic) VALUES(?,?,?,?,?,?)",slug,input.name,input.unit,input.target,input.handoff,input.topic);
    } else if (action === "update") {
      const post = (await get<{id:number}>("INSERT INTO updates(slug,title,body,image) VALUES(?,?,?,?) RETURNING id",slug,input.title,input.body,photo ? "" : input.image))!;
      if (photo) await all("INSERT INTO update_photos VALUES(?,?)",post.id,photo);
    } else if (action === "expense") {
      if (role !== "admin") throw new RuleError("Cần quyền quản trị để ghi khoản chi đã duyệt.");
      if (Number(input.amount) > c.received - c.spent) throw new RuleError("Khoản chi vượt quá số dư.");
      if (photo && input.publishPhoto!==1) throw new RuleError("Xác nhận ảnh đã che thông tin riêng tư trước khi công khai.");
      const expense=(await get<{id:number}>("INSERT INTO expenses(slug,title,amount,evidence) VALUES(?,?,?,?) RETURNING id",slug,input.title,input.amount,input.evidence))!;
      if (photo) await all("INSERT INTO expense_photos(expense_id,image,sha256) VALUES(?,?,?)",expense.id,photo,createHash("sha256").update(photo).digest("hex"));
    } else if (action === "hideExpensePhoto") {
      if (role!=="admin") throw new RuleError("Cần quyền quản trị để ẩn ảnh chứng từ.");
      const updated=await get("UPDATE expense_photos SET is_public=0 WHERE expense_id=(SELECT id FROM expenses WHERE id=? AND slug=?) AND is_public=1 RETURNING expense_id",input.expenseId,slug);
      if (!updated) throw new RuleError("Ảnh đã ẩn hoặc không thuộc chiến dịch này.");
    } else if (action === "receive" || action === "cancel") {
      const gift = await receipt(String(input.code));
      if (!gift || gift.slug !== slug || gift.kind !== "goods" || gift.status !== "pending") throw new RuleError("Phiếu đã xử lý hoặc không hợp lệ.");
      if (action === "receive" && Number(input.actual) > gift.amount) throw new RuleError("Số thực nhận không thể vượt quá số đã hẹn.");
      await all("UPDATE receipts SET status=?,actual=? WHERE code=?",action === "receive" ? "confirmed" : "cancelled",action === "receive" ? input.actual : null,gift.code);
    } else throw new RuleError("Thao tác không hợp lệ.");
  });
}
