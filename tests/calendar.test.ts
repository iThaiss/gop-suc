import assert from "node:assert/strict";
import { test } from "node:test";
import { volunteerCalendar } from "../lib/calendar.ts";

const shift={id:42,slug:"bep-am-cuoi-tuan",title:"Gói quà; chuẩn bị, phát cơm 🍚 "+"Đồ dùng học tập ".repeat(12),location:"Điểm A\\B\r\nATTENDEE:mailto:fake@example.org",startsAt:"2026-12-08T09:15:00+07:00"};
const stamp=new Date("2026-11-25T12:00:00Z");

test("tệp lịch có giờ UTC, xuống dòng đúng và giữ nguyên tiếng Việt sau khi mở nếp",()=>{
  const calendar=volunteerCalendar(shift,"https://gop-suc.example/",stamp);
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
  assert.ok(calendar.split("\r\n").every(line=>Buffer.byteLength(line,"utf8")<=75));
  const unfolded=calendar.replace(/\r\n /g,"");
  assert.match(unfolded,/\r\nDTSTART:20261208T021500Z\r\n/);
  assert.match(unfolded,/\r\nDTSTAMP:20261125T120000Z\r\n/);
  assert.match(unfolded,/Gói quà\\; chuẩn bị\\, phát cơm 🍚/);
  assert.match(unfolded,/LOCATION:Điểm A\\\\B\\nATTENDEE:mailto:fake@example.org/);
  assert.doesNotMatch(unfolded,/\r\nATTENDEE:|\r\nDTEND:|\r\nDURATION:|�/);
});

test("tệp chỉ có URL công khai và UID ổn định, không mang dữ liệu phiếu",()=>{
  const privateToken="private-test-token";
  const withPrivateField={...shift,code:privateToken};
  const calendar=volunteerCalendar(withPrivateField,"https://gop-suc.example/?ma="+privateToken,stamp).replace(/\r\n /g,"");
  assert.match(calendar,/UID:ca-42-bep-am-cuoi-tuan@gop-suc.example/);
  assert.match(calendar,/URL:https:\/\/gop-suc.example\/chien-dich\/bep-am-cuoi-tuan#tinh-nguyen/);
  assert.ok(!calendar.includes(privateToken));
  assert.match(calendar,/không xác nhận giữ chỗ/);
});
