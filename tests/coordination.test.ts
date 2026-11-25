import assert from "node:assert/strict";
import { test } from "node:test";
import { coordinationTasks, journalDraft } from "../lib/coordination.ts";
import type { Campaign, Need, VolunteerShift } from "../lib/domain.ts";

const now=Date.parse("2026-11-25T02:00:00Z");
const campaign=(slug:string,status:Campaign["status"],owner:Campaign["owner"]="organizer"):Campaign=>({slug,status,owner,title:slug,description:"",category:"Giáo dục",goal:100000,received:20000,spent:10000,location:"Huế",cover:"school"});
const campaigns=[campaign("open","active"),campaign("archive","closed"),campaign("private","active","admin"),campaign("to-review","draft"),campaign("private-draft","draft","admin")];
const shift=(id:number,slug:string,hours:number,reserved:number):VolunteerShift=>({id,slug,startsAt:new Date(now+hours*3_600_000).toISOString(),reserved,capacity:10,title:"Đóng gói",location:"Huế"});

test("điều phối chỉ hiện việc đúng quyền, ca còn trống trong 48 giờ và phiếu đang chờ",()=>{
  const counts=new Map([["open",2],["archive",3],["private",99],["to-review",4]]);
  const shifts=[shift(1,"open",48,7),shift(2,"open",3,2),shift(3,"open",2,8),shift(4,"open",-1,0),shift(5,"open",48.1,0),shift(6,"archive",2,0),shift(7,"private",1,0),shift(8,"to-review",3,0)];
  const organizer=coordinationTasks("organizer",campaigns,counts,shifts,now);
  assert.deepEqual(organizer.handoff.map(item=>[item.campaign.slug,item.pending]),[["archive",3],["open",2]]);
  assert.deepEqual(organizer.shortShifts.map(item=>[item.shift.id,item.open]),[[2,8],[1,3]]);
  assert.deepEqual(organizer.review.map(item=>item.slug),["to-review"]);
  const admin=coordinationTasks("admin",campaigns,counts,shifts,now);
  assert.equal(admin.shortShifts[0].shift.id,7);
  assert.equal(admin.handoff[0].pending,99);
  assert.deepEqual(admin.review.map(item=>item.slug),["to-review","private-draft"]);
});

test("bản nháp phân biệt số đã nhận và số hẹn; không tuyên bố đã phân phối",()=>{
  const template:Need={id:1,slug:"open",name:"Bộ dụng cụ học tập",unit:"bộ",topic:"learning",handoff:"Địa điểm không cần đưa vào bài",target:15,received:6,pledged:2};
  const draft=journalDraft(campaigns[0],[template,{...template,id:2,name:"Món chưa có dữ liệu",received:0,pledged:0}]);
  assert.match(draft.body,/20[.]000.*10[.]000/);
  assert.match(draft.body,/đã nhận 6 bộ, đang hẹn giao 2 bộ/);
  assert.doesNotMatch(draft.body,/Món chưa có dữ liệu|Địa điểm không cần đưa vào bài|đã phân phối/);
  assert.ok(draft.body.length<=900);
});
