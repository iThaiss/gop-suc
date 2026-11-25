import assert from "node:assert/strict";
import { once } from "node:events";
import { createInterface } from "node:readline";
import pg from "pg";
import { postgresConfig } from "../lib/postgres-config.ts";

let url=process.env.DATABASE_URL;
if (!url) {
  const stdin=createInterface({input:process.stdin});
  const [line]=await once(stdin,"line");
  stdin.close();
  url=line.trim();
}
if (!url) throw new Error("Missing DATABASE_URL");
process.env.DATABASE_URL=url;
const {all,bookVolunteer,campaign,campaigns,cancelVolunteer,confirmCash,contribute,manage,needs,publicUpdatePhoto,transaction,updates,volunteerShifts}=await import("../lib/db.ts");
const [rows,items,posts,shifts]=await Promise.all([
  campaigns(),needs(),updates("lop-hoc-sau-mua"),volunteerShifts("lop-hoc-sau-mua"),
]);
assert.ok(rows.length>=3 && typeof rows[0].received==="number");
assert.ok(items.some(item=>item.topic==="learning" && typeof item.pledged==="number"));
assert.ok(posts.length && typeof posts[0].hasPhoto==="number");
assert.ok(shifts.length && typeof shifts[0].startsAt==="string");

const pool=new pg.Pool(postgresConfig(url));
const session=await pool.connect();
try {
  await session.query("BEGIN");
  const found=await session.query("insert into gopsuc.limits (key,count,until) values ($1,1,0) returning count",["deployment-check"]);
  assert.equal(found.rows[0].count,1);
  const roles=await session.query("select has_schema_privilege('anon','gopsuc','USAGE') as anon, current_user as role");
  assert.equal(roles.rows[0].anon,false);
  assert.equal(roles.rows[0].role,"gopsuc_runtime");
  console.log("PostgreSQL: read models, runtime writes, and private schema verified.");
} finally {
  await session.query("ROLLBACK");
  session.release();
  await pool.end();
}
const rollback = new Error("discard validation fixtures");
await assert.rejects(transaction(async()=>{
  const slug="kiem-tra-trien-khai";
  const draft={title:"Test",description:"Test",category:"Giáo dục",location:"Huế",cover:"school",goal:50_000};
  await manage("organizer",slug,"create",draft);
  await manage("organizer",slug,"editDraft",{...draft,title:"Updated"});
  await manage("admin",slug,"publish",{});
  const cash=await contribute({slug,kind:"cash",amount:25000});
  assert.equal((await confirmCash(cash.code)).duplicate,false);
  assert.equal((await confirmCash(cash.code)).duplicate,true);
  assert.equal((await campaign(slug)).received,25000);
  await manage("organizer",slug,"need",{name:"Dụng cụ",unit:"bộ",target:5,handoff:"Điểm demo",topic:"learning"});
  const [item]=await needs(slug);
  const goods=await contribute({slug,kind:"goods",amount:5,needId:item.id});
  await assert.rejects(contribute({slug,kind:"goods",amount:1,needId:item.id}), /vượt quá/);
  await manage("organizer",slug,"receive",{code:goods.code,actual:4});
  assert.equal((await needs(slug))[0].received,4);
  const bytes=Buffer.from("binary persistence check");
  await manage("organizer",slug,"update",{title:"Test photo",body:"Test report",image:""},bytes);
  const [post]=await updates(slug);
  assert.deepEqual(await publicUpdatePhoto(slug,post.id),bytes);
  const local=new Date(Date.now()+48*3600_000).toISOString().slice(0,16);
  await manage("organizer",slug,"addShift",{title:"Test shift",location:"Demo",startLocal:local,capacity:1});
  const [shift]=await volunteerShifts(slug);
  const booking=await bookVolunteer(slug,shift.id);
  await assert.rejects(bookVolunteer(slug,shift.id),/đủ người/);
  assert.equal((await cancelVolunteer(booking.code)).status,"cancelled");
  await all("INSERT INTO sessions VALUES(?,?,?)","deployment-check","admin",0);
  await all("DELETE FROM sessions WHERE token=?","deployment-check");
  await manage("admin",slug,"expense",{title:"Test",amount:25000,evidence:"Demo"});
  assert.equal((await campaign(slug)).spent,25000);
  throw rollback;
}),error=>error===rollback);
assert.equal(await campaign("kiem-tra-trien-khai"),undefined);
console.log("Campaigns, QR, goods, multimedia, shifts, sessions and expenses verified without keeping test data.");
process.exit(0);
