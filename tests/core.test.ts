import assert from "node:assert/strict";
import { test } from "node:test";
import { campaign, confirmCash, contribute, manage, needs, publicGifts, receipt } from "../lib/db.ts";
import { classify, findMatches } from "../lib/match.ts";

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
  assert.throws(()=>manage("organizer","kiem-thu","publish",{}),/quản trị/);
  assert.throws(()=>contribute({slug:"kiem-thu",kind:"cash",amount:5000}),/ngừng/);
  manage("admin","kiem-thu","publish",{});
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
