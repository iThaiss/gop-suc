import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { bookVolunteer, campaign, cancelVolunteer, confirmCash, contribute, manage, needs, publicGifts, publicUpdatePhoto, receipt, updates, volunteerBooking, volunteerShifts } from "../lib/db.ts";
import { classify, findMatches } from "../lib/match.ts";
import { receiptAccessFromFragment, receiptPath } from "../lib/receipt-access.ts";
import { encodeUpdateImage } from "../lib/update-image.ts";

process.env.DATABASE_FILE = ":memory:";
const slug = "lop-hoc-sau-mua";

test("liên kết riêng để khóa trong fragment và liên kết chỉ xem không chứa khóa", () => {
  const code="a".repeat(32), token="b".repeat(64);
  const privateUrl=new URL(receiptPath(code,token),"https://gopsuc.example");
  assert.equal(privateUrl.searchParams.get("ma"),code);
  assert.ok(!privateUrl.search.includes(token));
  assert.equal(receiptAccessFromFragment(privateUrl.hash),token);
  assert.equal(receiptAccessFromFragment(privateUrl.hash+"&other=1"),null);
  const publicUrl=new URL(receiptPath(code),privateUrl.origin);
  assert.equal(publicUrl.hash,"");
  assert.ok(!publicUrl.href.includes(token));
});

test("tiền chỉ cộng sau xác nhận và xác nhận lặp không cộng hai lần", async () => {
  const before = (await campaign(slug))!.received;
  const {gift,actionToken} = await contribute({slug,kind:"cash",amount:50_000});
  assert.equal((await campaign(slug))!.received,before);
  assert.match(actionToken??"",/^[a-f0-9]{64}$/);
  await assert.rejects(confirmCash(gift.code),/liên kết thao tác riêng/);
  assert.equal((await confirmCash(gift.code,actionToken!)).duplicate,false);
  assert.equal((await confirmCash(gift.code,actionToken!)).duplicate,true);
  assert.equal((await campaign(slug))!.received,before+50_000);
  assert.equal((await publicGifts(slug))[0].name,"****");
  assert.ok(!("name" in (await receipt(gift.code))!));
  assert.ok(!("action_hash" in (await receipt(gift.code))!));
});

test("hẹn giao không vượt mục tiêu và cho phép xác nhận số thực nhận", async () => {
  const item=(await needs(slug))[0];
  await assert.rejects(()=>contribute({slug,kind:"goods",needId:item.id,amount:50}),/vượt quá/);
  const {gift,actionToken}=await contribute({slug,kind:"goods",needId:item.id,amount:15});
  assert.equal(actionToken,null);
  assert.equal((await needs(slug))[0].pledged,15);
  assert.equal((await needs(slug))[0].received,80);
  await assert.rejects(()=>manage("organizer",slug,"receive",{code:gift.code,actual:16}),/vượt quá/);
  await manage("organizer",slug,"receive",{code:gift.code,actual:12});
  assert.equal((await needs(slug))[0].pledged,0);
  assert.equal((await needs(slug))[0].received,92);
  await assert.rejects(()=>manage("organizer",slug,"receive",{code:gift.code,actual:12}),/đã xử lý/);
});

test("phân quyền duyệt, ghi chi và đóng chiến dịch", async () => {
  await manage("organizer","kiem-thu","create",{title:"Kiểm thử",description:"Demo",category:"Giáo dục",location:"Huế",cover:"school",goal:200000});
  assert.equal((await campaign("kiem-thu"))!.status,"draft");
  const updated={title:"Tên đã sửa",description:"Demo",category:"Giáo dục",location:"Huế",cover:"school",goal:300000};
  await manage("organizer","kiem-thu","editDraft",updated);
  assert.equal((await campaign("kiem-thu"))!.title,"Tên đã sửa");
  assert.equal((await campaign("kiem-thu"))!.goal,300000);
  await assert.rejects(()=>manage("organizer","kiem-thu","publish",{}),/quản trị/);
  await assert.rejects(()=>contribute({slug:"kiem-thu",kind:"cash",amount:5000}),/ngừng/);
  await manage("admin","kiem-thu","publish",{});
  await assert.rejects(()=>manage("organizer","kiem-thu","editDraft",updated),/chờ duyệt/);
  await assert.rejects(()=>manage("admin","kiem-thu","expense",{title:"A",amount:1,evidence:"B"}),/số dư/);
  await manage("admin","kiem-thu","close",{});
  await assert.rejects(()=>contribute({slug:"kiem-thu",kind:"cash",amount:5000}),/ngừng/);
});

test("AI nhận dạng tiếng Việt và số còn nhận lấy từ cơ sở dữ liệu", async () => {
  const examples = new Map([
    ["Minh co 15 bo dung cu hoc tap cuoi tuan","learning"],
    ["Tôi có túi gạo 5 kg muốn gửi","food"],
    ["Có vài chiếc chăn bông muốn tặng","blankets"],
    ["Bạn hướng dẫn chuyển khoản giúp mình","money"],
    ["Mình có xà phòng và chổi","cleaning"],
  ]);
  for (const [query,topic] of examples) assert.equal(classify(query)[0]?.id,topic,query);
  assert.equal(findMatches("bộ dụng cụ học tập",(await needs())).goods[0].available,28);
  assert.equal(findMatches("tôi có một cây đàn piano",(await needs())).goods.length,0);
});

test("AI chỉ điền số lượng cùng đơn vị và không vượt sức nhận", async () => {
  const rows=await needs();
  const school=(query:string)=>findMatches(query,rows).goods.find(n=>n.topic==="learning");
  assert.equal(school("Mình có 15 bộ dụng cụ học tập")?.suggested,15);
  const partial=school("Mình có 90 bộ dụng cụ học tập");
  assert.equal(partial?.requested,90);
  assert.equal(partial?.suggested,28);
  assert.equal(school("Mình có 15 chiếc bút")?.suggested,undefined);
  assert.equal(school("Mình có 15–20 bộ dụng cụ học tập")?.suggested,undefined);
  assert.equal(school("Mình có 15 bộ dụng cụ học tập và 5 kg gạo")?.suggested,undefined);
  assert.equal(findMatches("Tôi góp 5 ký gạo",rows).goods.find(n=>n.topic==="food")?.suggested,5);
});

test("Ảnh cập nhật được nén, bỏ metadata và chỉ công khai sau khi duyệt chiến dịch", async () => {
  const source = await sharp({create:{width:1600,height:300,channels:3,background:"green"}}).withMetadata().jpeg().toBuffer();
  const photo = await encodeUpdateImage(new File([Uint8Array.from(source)],"test.jpg",{type:"image/jpeg"}));
  const output = await sharp(photo).metadata();
  assert.equal(output.format,"webp");
  assert.equal(output.width,1280);
  assert.equal(output.exif,undefined);
  await assert.rejects(encodeUpdateImage(new File(["not a photo"],"fake.png",{type:"image/png"})),/Không đọc được ảnh/);
  await manage("organizer","thu-anh","create",{title:"Ảnh bàn giao",description:"Demo",category:"Giáo dục",location:"Huế",cover:"school",goal:50000});
  await manage("organizer","thu-anh","update",{title:"Cập nhật",body:"Demo",image:"school"},photo);
  const [post]=(await updates("thu-anh"));
  assert.equal(post.hasPhoto,1);
  assert.equal(post.image,"");
  assert.equal((await publicUpdatePhoto("thu-anh",post.id)),undefined);
  await manage("admin","thu-anh","publish",{});
  assert.deepEqual(Buffer.from((await publicUpdatePhoto("thu-anh",post.id))!),photo);
  assert.equal((await publicUpdatePhoto(slug,post.id)),undefined);
});

test("giữ chỗ tình nguyện không vượt sức chứa và hủy để mở lại chỗ", async () => {
  const local=new Date(Date.now()+48*3600_000).toISOString().slice(0,16);
  const fields={title:"Soạn hàng",location:"Điểm demo",startLocal:local,capacity:1};
  await manage("organizer",slug,"addShift",fields);
  const shift=(await volunteerShifts(slug)).find(item=>item.title===fields.title)!;
  assert.equal(shift.startsAt,new Date(local+":00+07:00").toISOString());
  const {booking,actionToken}=await bookVolunteer(slug,shift.id);
  assert.equal((await volunteerBooking(booking.code))?.status,"booked");
  await assert.rejects(()=>bookVolunteer(slug,shift.id),/đủ người/);
  await assert.rejects(()=>bookVolunteer("bep-am-cuoi-tuan",shift.id),/không còn mở/);
  await assert.rejects(cancelVolunteer(booking.code),/liên kết thao tác riêng/);
  assert.equal((await cancelVolunteer(booking.code,actionToken)).status,"cancelled");
  assert.equal((await cancelVolunteer(booking.code,actionToken)).status,"cancelled");
  assert.equal((await bookVolunteer(slug,shift.id)).booking.status,"booked");
  await assert.rejects(()=>manage("organizer",slug,"addShift",{...fields,startLocal:"2025-02-30T12:00"}),/tương lai/);
});
