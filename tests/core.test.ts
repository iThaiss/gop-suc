import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { campaign, confirmCash, contribute, manage, needs, publicGifts, publicUpdatePhoto, receipt, updates } from "../lib/db.ts";
import { classify, findMatches } from "../lib/match.ts";
import { encodeUpdateImage } from "../lib/update-image.ts";

process.env.DATABASE_FILE = ":memory:";
const slug = "lop-hoc-sau-mua";

test("tiền chỉ cộng sau xác nhận và xác nhận lặp không cộng hai lần", () => {
  const before = campaign(slug)!.received;
  const gift = contribute({slug,kind:"cash",amount:50_000});
  assert.equal(campaign(slug)!.received,before);
  assert.equal(confirmCash(gift.code).duplicate,false);
  assert.equal(confirmCash(gift.code).duplicate,true);
  assert.equal(campaign(slug)!.received,before+50_000);
  assert.equal(publicGifts(slug)[0].name,"****");
  assert.ok(!("name" in receipt(gift.code)!));
});

test("hẹn giao không vượt mục tiêu và cho phép xác nhận số thực nhận", () => {
  const item=needs(slug)[0];
  assert.throws(()=>contribute({slug,kind:"goods",needId:item.id,amount:50}),/vượt quá/);
  const gift=contribute({slug,kind:"goods",needId:item.id,amount:15});
  assert.equal(needs(slug)[0].pledged,15);
  assert.equal(needs(slug)[0].received,80);
  assert.throws(()=>manage("organizer",slug,"receive",{code:gift.code,actual:16}),/vượt quá/);
  manage("organizer",slug,"receive",{code:gift.code,actual:12});
  assert.equal(needs(slug)[0].pledged,0);
  assert.equal(needs(slug)[0].received,92);
  assert.throws(()=>manage("organizer",slug,"receive",{code:gift.code,actual:12}),/đã xử lý/);
});

test("phân quyền duyệt, ghi chi và đóng chiến dịch", () => {
  manage("organizer","kiem-thu","create",{title:"Kiểm thử",description:"Demo",category:"Giáo dục",location:"Huế",cover:"school",goal:200000});
  assert.equal(campaign("kiem-thu")!.status,"draft");
  const updated={title:"Tên đã sửa",description:"Demo",category:"Giáo dục",location:"Huế",cover:"school",goal:300000};
  manage("organizer","kiem-thu","editDraft",updated);
  assert.equal(campaign("kiem-thu")!.title,"Tên đã sửa");
  assert.equal(campaign("kiem-thu")!.goal,300000);
  assert.throws(()=>manage("organizer","kiem-thu","publish",{}),/quản trị/);
  assert.throws(()=>contribute({slug:"kiem-thu",kind:"cash",amount:5000}),/ngừng/);
  manage("admin","kiem-thu","publish",{});
  assert.throws(()=>manage("organizer","kiem-thu","editDraft",updated),/chờ duyệt/);
  assert.throws(()=>manage("admin","kiem-thu","expense",{title:"A",amount:1,evidence:"B"}),/số dư/);
  manage("admin","kiem-thu","close",{});
  assert.throws(()=>contribute({slug:"kiem-thu",kind:"cash",amount:5000}),/ngừng/);
});

test("AI nhận dạng tiếng Việt và số còn nhận lấy từ cơ sở dữ liệu", () => {
  const examples = new Map([
    ["Minh co 15 bo dung cu hoc tap cuoi tuan","learning"],
    ["Tôi có túi gạo 5 kg muốn gửi","food"],
    ["Có vài chiếc chăn bông muốn tặng","blankets"],
    ["Bạn hướng dẫn chuyển khoản giúp mình","money"],
    ["Mình có xà phòng và chổi","cleaning"],
  ]);
  for (const [query,topic] of examples) assert.equal(classify(query)[0]?.id,topic,query);
  assert.equal(findMatches("bộ dụng cụ học tập",needs()).goods[0].available,28);
  assert.equal(findMatches("tôi có một cây đàn piano",needs()).goods.length,0);
});

test("AI chỉ điền số lượng cùng đơn vị và không vượt sức nhận", () => {
  const rows=needs();
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
  manage("organizer","thu-anh","create",{title:"Ảnh bàn giao",description:"Demo",category:"Giáo dục",location:"Huế",cover:"school",goal:50000});
  manage("organizer","thu-anh","update",{title:"Cập nhật",body:"Demo",image:"school"},photo);
  const [post]=updates("thu-anh");
  assert.equal(post.hasPhoto,1);
  assert.equal(post.image,"");
  assert.equal(publicUpdatePhoto("thu-anh",post.id),undefined);
  manage("admin","thu-anh","publish",{});
  assert.deepEqual(Buffer.from(publicUpdatePhoto("thu-anh",post.id)!),photo);
  assert.equal(publicUpdatePhoto(slug,post.id),undefined);
});
