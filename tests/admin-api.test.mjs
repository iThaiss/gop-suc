import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rmdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import sharp from "sharp";

const require = createRequire(import.meta.url);

async function localPort() {
  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

test("lưu quản trị, tra cứu và quyền thao tác riêng qua HTTP", { timeout: 30_000 }, async (t) => {
  const port = await localPort();
  const origin = `http://127.0.0.1:${port}`;
  const directory = await mkdtemp(join(tmpdir(), "gopsuc-api-"));
  const database = join(directory, "test.sqlite");
  const passwords = { organizer: "local-organizer-test-only", admin: "local-admin-test-only" };
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      VERCEL: "",
      DATABASE_FILE: database,
      SITE_URL: origin,
      ADMIN_PASSWORD: passwords.admin,
      ORGANIZER_PASSWORD: passwords.organizer,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", part => { log = (log + part).slice(-4000); });
  const closed = new Promise(resolve => child.once("close", resolve));
  child.on("error", error => { log += error.message; });
  t.after(async () => {
    child.kill();
    await closed;
    for (const path of [database, database + "-wal", database + "-shm", database + "-journal"]) await rm(path, { force: true });
    await rmdir(directory);
  });

  let ready = false;
  for (let i = 0; i < 80 && child.exitCode === null; i++) {
    try {
      const response = await fetch(origin + "/tra-cuu", { signal: AbortSignal.timeout(400) });
      await response.body?.cancel();
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(150);
  }
  assert.ok(ready, `Không khởi động được bản build để kiểm thử. Chạy npm run build trước.\n${log}`);

  async function post(data, cookie) {
    return fetch(origin + "/api/gopsuc", {
      method: "POST",
      headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    });
  }
  async function login(role) {
    const response = await post({ action: "login", role, password: passwords[role] });
    assert.equal(response.status, 200);
    const session = response.headers.get("set-cookie");
    assert.match(session ?? "", /HttpOnly/i);
    return session.split(";")[0];
  }

  const organizer = await login("organizer");
  const admin = await login("admin");
  const slug = "kiem-thu-luu-quan-tri";
  const title = "Chiến dịch kiểm thử lưu quản trị";
  const draft = { action: "create", slug, title, description: "Dữ liệu kiểm thử riêng.", category: "Giáo dục", location: "Huế", cover: "school", goal: 100_000 };
  assert.equal((await post(draft)).status, 401);
  assert.equal((await post(draft, organizer)).status, 200);
  const adminOnly={...draft,slug:"noi-bo-cua-quan-tri",title:"Bản nháp chỉ quản trị viên xem"};
  assert.equal((await post(adminOnly,admin)).status,200);
  const calendarBase=`${origin}/api/gopsuc/volunteer-calendar`;
  const privateStart=new Date(Date.now()+31*3_600_000).toISOString().slice(0,16);
  assert.equal((await post({action:"addShift",slug:adminOnly.slug,title:"Ca chưa công bố",location:"Điểm nội bộ",startLocal:privateStart,capacity:5},admin)).status,200);
  assert.equal((await fetch(`${calendarBase}/${adminOnly.slug}/2`)).status,404);
  const panel=async (url,cookie)=>await (await fetch(`${origin}/quan-tri${url}`,{headers:cookie?{cookie}:{}})).text();
  assert.doesNotMatch(await panel("",null),/id="ban-dieu-phoi"/);
  const orgBoard=await panel("",organizer);
  assert.match(orgBoard,/id="ban-dieu-phoi"/);
  assert.match(orgBoard,/muc=overview(?:&amp;[^#]+)?#duyet/);
  assert.ok(!orgBoard.includes(adminOnly.title));
  assert.ok((await panel("",admin)).includes(adminOnly.title));
  const path = `${origin}/chien-dich/${slug}`;
  assert.equal((await fetch(path)).status, 404);

  const denied = await post({ action: "publish", slug }, organizer);
  assert.equal(denied.status, 409);
  assert.match((await denied.json()).error, /quyền quản trị/);

  assert.equal((await post({ action: "publish", slug }, admin)).status, 200);
  const campaign = await fetch(path);
  assert.equal(campaign.status, 200);
  assert.ok((await campaign.text()).includes(title));

  const updateTitles = ["Chuẩn bị điểm nhận", "Kiểm đếm 6 bộ", "Công bố ngày bàn giao"];
  for (const title of updateTitles) {
    assert.equal((await post({action:"update",slug,title,body:"Nhật ký thử nghiệm",image:""}, organizer)).status, 200);
  }
  assert.equal((await post({action:"need",slug,name:"Dụng cụ kiểm thử",unit:"bộ",target:10,handoff:"Điểm nhận thử",topic:"learning"}, organizer)).status, 200);
  const {goods} = await (await post({action:"match",query:"Mình có 8 bộ dụng cụ học tập"})).json();
  const need = goods.find(item => item.slug === slug);
  assert.ok(need);
  const booking = await post({action:"contribute",slug,kind:"goods",amount:8,needId:need.id,anonymous:true});
  assert.equal(booking.status, 201);
  const {gift:pledge} = await booking.json();
  const startsLocal=new Date(Date.now()+19*3_600_000).toISOString().slice(0,16); // 12 hours ahead in Viet Nam.
  assert.equal((await post({action:"addShift",slug,title:"Ca tập trung sớm",location:"Điểm nhận thử",startLocal:startsLocal,capacity:5},organizer)).status,200);
  const operations=await panel("",organizer);
  assert.match(operations,/muc=handoff#ban-giao/);
  assert.match(operations,/muc=volunteer#ca-\d+/);
  assert.match(operations,/Ca tập trung sớm/);
  const basicLookup = await (await post({action:"lookup",code:pledge.code})).json();
  assert.equal(basicLookup.gift.status, "pending");
  assert.ok(!("impact" in basicLookup));
  assert.equal((await post({action:"receive",slug,code:pledge.code,actual:6}, organizer)).status, 200);
  const lookup = await post({action:"lookup",code:pledge.code,withImpact:true});
  assert.equal(lookup.status, 200);
  assert.equal(lookup.headers.get("cache-control"), "no-store");
  const {gift,impact} = await lookup.json();
  assert.equal(gift.amount, 8);
  assert.equal(gift.actual, 6);
  const draftView=await panel(`?chien=${slug}&muc=journal`,organizer);
  assert.match(draftView,/Soạn nháp từ số liệu/);
  assert.match(draftView,/đã nhận 6 bộ, đang hẹn giao 0 bộ/);
  assert.deepEqual(Object.keys(impact).sort(), ["goal","received","slug","spent","status","title","updates"]);
  assert.deepEqual(impact.updates.map(post=>post.title), updateTitles.slice(1).reverse());
  assert.ok(!JSON.stringify(impact).includes(pledge.code));
  const {goods:available} = await (await post({action:"match",query:"Mình có 8 bộ dụng cụ học tập"})).json();
  assert.equal(available.find(item => item.slug === slug)?.available, 4);
  const goodsRace = await Promise.all(Array.from({length:5},()=>post({action:"contribute",slug,kind:"goods",amount:1,needId:need.id,anonymous:true})));
  assert.deepEqual(goodsRace.map(item=>item.status).sort(),[201,201,201,201,409]);
  await Promise.all(goodsRace.map(item=>item.body?.cancel()));

  const overBudget = await post({ action: "expense", slug, title: "Vượt ngân sách", amount: 1, evidence: "Chứng từ mô phỏng" }, admin);
  assert.equal(overBudget.status, 409);
  assert.match((await overBudget.json()).error, /vượt quá số dư/);

  const cashResponse = await post({action:"contribute",slug,kind:"cash",amount:20_000,anonymous:true});
  assert.equal(cashResponse.status, 201);
  const {gift:cash,actionToken:cashToken,qr} = await cashResponse.json();
  assert.match(qr,/^data:image\/png;base64,/);
  assert.match(cashToken,/^[a-f0-9]{64}$/);
  const cashLookup=(await (await post({action:"lookup",code:cash.code})).json());
  assert.equal(cashLookup.gift.status,"pending");
  assert.ok(!JSON.stringify(cashLookup).includes(cashToken));
  assert.ok(!("action_hash" in cashLookup.gift));
  assert.equal((await post({action:"confirm",code:cash.code})).status,403);
  assert.equal((await post({action:"confirm",code:cash.code,actionToken:cashToken})).status,200);
  const repeatConfirm=await (await post({action:"confirm",code:cash.code,actionToken:cashToken})).json();
  assert.equal(repeatConfirm.duplicate,true);
  assert.equal(repeatConfirm.receipt.status,"confirmed");

  const picture=await sharp({create:{width:400,height:600,channels:3,background:"white"}}).withMetadata().jpeg().toBuffer();
  const submitProof=(cookie,consent,proof=picture,amount="6000")=>{
    const form=new FormData();
    for(const [key,value] of Object.entries({action:"expense",slug,title:"Chứng từ chi thử",amount,evidence:"Chỉ là chứng từ mô phỏng."})) form.set(key,value);
    if(consent) form.set("publishPhoto","yes");
    form.set("photo",new Blob([proof],{type:"image/jpeg"}),"demo.jpg");
    return fetch(`${origin}/api/gopsuc`,{method:"POST",headers:{origin,cookie},body:form});
  };
  assert.equal((await submitProof(organizer,true)).status,403);
  assert.equal((await submitProof(admin,false)).status,400);
  assert.equal((await submitProof(admin,true,Buffer.from("not an image"))).status,400);
  assert.equal((await submitProof(admin,true,picture,"30000")).status,409);
  assert.doesNotMatch(await (await fetch(path)).text(),/Chứng từ chi thử/);
  assert.equal((await submitProof(admin,true)).status,201);
  const ledger=await (await fetch(path)).text();
  const imagePath=ledger.match(new RegExp(`/api/gopsuc/expense-photos/${slug}/(\\d+)`));
  assert.ok(imagePath);
  const proof=await fetch(origin+imagePath[0]);
  assert.equal(proof.status,200);
  assert.equal(proof.headers.get("content-type"),"image/webp");
  assert.equal(proof.headers.get("cache-control"),"no-store");
  const published=Buffer.from(await proof.arrayBuffer());
  assert.ok(ledger.includes(createHash("sha256").update(published).digest("hex")));
  assert.equal((await sharp(published).metadata()).exif,undefined);
  assert.equal((await fetch(`${origin}/api/gopsuc/expense-photos/lop-hoc-sau-mua/${imagePath[1]}`)).status,404);
  const hide={action:"hideExpensePhoto",slug,expenseId:Number(imagePath[1])};
  assert.equal((await post(hide,organizer)).status,409);
  assert.equal((await post(hide,admin)).status,200);
  assert.equal((await fetch(origin+imagePath[0])).status,404);
  const retained=await (await fetch(path)).text();
  assert.match(retained,/Chứng từ chi thử/);
  assert.ok(!retained.includes(imagePath[0]));

  const shiftId = 1; // The first shift belongs to the seeded campaign in a fresh test database.
  const first = await post({action:"bookVolunteer",slug:"lop-hoc-sau-mua",shiftId});
  assert.equal(first.status,201);
  const {booking:volunteer,actionToken:volunteerToken}=await first.json();
  assert.equal(volunteer.shiftId,shiftId);
  const calendar=await fetch(`${calendarBase}/${volunteer.slug}/${volunteer.shiftId}`);
  assert.equal(calendar.status,200);
  assert.match(calendar.headers.get("content-type"),/text\/calendar/);
  assert.match(calendar.headers.get("content-disposition"),/gop-suc-ca-1\.ics/);
  assert.equal(calendar.headers.get("cache-control"),"no-store");
  const calendarText=await calendar.text();
  assert.match(calendarText,/DTSTART:\d{8}T\d{6}Z/);
  assert.ok(!calendarText.includes(volunteer.code)&&!calendarText.includes(volunteerToken));
  assert.equal((await fetch(`${calendarBase}/bep-am-cuoi-tuan/${volunteer.shiftId}`)).status,404);
  assert.equal((await post({action:"cancelVolunteer",code:volunteer.code})).status,403);
  assert.equal((await post({action:"cancelVolunteer",code:volunteer.code,actionToken:cashToken})).status,403);
  const volunteerLookup=await (await post({action:"lookup",code:volunteer.code,withImpact:true})).json();
  assert.equal(volunteerLookup.booking.status,"booked");
  assert.ok(!("action_hash" in volunteerLookup.booking));
  assert.ok(!JSON.stringify(volunteerLookup).includes(volunteerToken));
  const cancelled=await post({action:"cancelVolunteer",code:volunteer.code,actionToken:volunteerToken});
  assert.equal(cancelled.status,200);
  assert.equal((await cancelled.json()).booking.status,"cancelled");
  const assist=await post({action:"assist",input:{source:"query",query:"Mình có 15 bộ dụng cụ học tập ở Quảng Nam, muốn phụ đóng gói hoặc góp 200k"}});
  assert.equal(assist.status,200);
  const live=await assist.json();
  assert.deepEqual(live.filters.modes,["goods","volunteer","cash"]);
  assert.equal(live.goods[0].suggested,15);
  assert.equal(live.volunteer[0].available,8);
  assert.equal(live.cash[0].amount,200_000);
  const refined=await post({action:"assist",input:{source:"filters",filters:{...live.filters,location:"Huế"}}});
  assert.equal(refined.status,200);
  const edited=await refined.json();
  assert.deepEqual(edited.goods,[]);
  assert.deepEqual(edited.volunteer,[]);
  assert.ok(edited.cash.length>0&&edited.cash.every(item=>item.campaign.location==="Huế"));
  const volunteerRace=await Promise.all(Array.from({length:9},()=>post({action:"bookVolunteer",slug:"lop-hoc-sau-mua",shiftId})));
  assert.deepEqual(volunteerRace.map(item=>item.status).sort(),[201,201,201,201,201,201,201,201,409]);
  await Promise.all(volunteerRace.map(item=>item.body?.cancel()));
  const noSeats=await (await post({action:"assist",input:{source:"filters",filters:live.filters}})).json();
  assert.deepEqual(noSeats.volunteer,[]);

  assert.equal((await post({ action: "close", slug }, admin)).status, 200);
  const closedCampaign = await fetch(path);
  assert.match(await closedCampaign.text(), /Chiến dịch đã kết thúc/);
  assert.equal((await post({ action: "contribute", slug, amount: 50_000, kind: "cash", anonymous: true })).status, 409);
  const closedLookup = await (await post({action:"lookup",code:pledge.code,withImpact:true})).json();
  assert.equal(closedLookup.impact.status, "closed");
});
