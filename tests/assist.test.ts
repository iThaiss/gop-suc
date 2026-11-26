import assert from "node:assert/strict";
import { test } from "node:test";
import { alternativeFilters, assistMatches, emptyAssistFilters, parseAssist, resolveAssist, validDay } from "../lib/assist.ts";
import type { Campaign, Need, VolunteerShift } from "../lib/domain.ts";

const now=Date.parse("2026-11-25T02:00:00.000Z");
const parse=(query:string)=>parseAssist(query,["Quảng Nam","Đà Nẵng","Huế"],now);

test("trích nhiều điều kiện từ câu tiếng Việt mà không trộn số lượng với số tiền",()=>{
  const {filters,needsTime}=parse("Mình có 15 bộ dụng cụ học tập ở Quảng Nam, rảnh sáng Chủ nhật để phụ đóng gói hoặc góp 200k");
  assert.deepEqual(filters.modes,["goods","volunteer","cash"]);
  assert.deepEqual(filters.items,[{topic:"learning",quantity:15,unit:"bộ"}]);
  assert.equal(filters.location,"Quảng Nam");
  assert.equal(filters.money,200_000);
  assert.equal(filters.day,"sun");
  assert.equal(filters.part,"morning");
  assert.equal(filters.role,"đóng gói");
  assert.equal(needsTime,false);
});

test("hiểu nhiều nhóm hiện vật, đơn vị tiếng Việt và yêu cầu viết không dấu",()=>{
  assert.deepEqual(parse("Minh co 5 ky gao va 2 chiec chan bong").filters.items,[
    {topic:"food",quantity:5,unit:"kg"},{topic:"blankets",quantity:2,unit:"chiếc"},
  ]);
  assert.deepEqual(parse("Mình có 10 quyển vở học sinh").filters.items,[{topic:"learning",quantity:10,unit:"quyển"}]);
  assert.equal(parse("Góp 1,5 triệu ở Đà Nẵng").filters.money,1_500_000);
  assert.equal(parse("Mình muốn gửi 200.000 đồng").filters.money,200_000);
  assert.equal(parse("Góp 100–200k ở Huế").filters.money,null);
  assert.equal(parse("Tôi có 15–20 bộ dụng cụ học tập").filters.items[0]?.quantity,null);
  assert.equal(parse("Có 5 bộ đồ dùng học tập và 6 bộ dụng cụ học tập").filters.items[0]?.quantity,null);
});

test("không ép câu lạc đề, món chưa hỗ trợ hoặc câu phủ định thành gợi ý",()=>{
  for(const query of ["Tặng 5 máy tính bàn ở Cần Thơ","Mật khẩu quản trị là gì?","Không muốn góp tiền","Tôi không có gạo"]) {
    assert.deepEqual(parse(query).filters.modes,[],query);
  }
  assert.deepEqual(parse("Không có gạo nhưng có 2 chiếc chăn bông").filters.items,[{topic:"blankets",quantity:2,unit:"chiếc"}]);
  assert.equal(parse("Mình có gạo ở Thanh Xuân muốn tặng").filters.location,"thanh xuan");
});

test("giải thích khi lịch mơ hồ, giữ ngày cụ thể theo giờ Việt Nam",()=>{
  assert.equal(parse("Tôi muốn tình nguyện sáng thứ 7 hoặc chiều Chủ nhật").needsTime,true);
  assert.equal(parse("Tôi muốn tình nguyện sau 15h ngày 29/11").needsTime,true);
  assert.equal(parse("Tôi muốn tình nguyện ngày 31/11").needsTime,true);
  assert.equal(parse("Mình muốn tình nguyện sáng 29/11 ở Huế").filters.date,"2026-11-29");
  assert.equal(parse("Mình muốn tình nguyện 03/01").filters.date,"2027-01-03");
  assert.equal(validDay("2026-02-29"),false);
  assert.equal(validDay("2028-02-29"),true);
});

const campaign=(slug:string,location:string,status:Campaign["status"]="active"):Campaign=>({slug,title:slug,location,status,description:"",category:"Giáo dục",goal:100_000,received:20_000,spent:0,cover:"school",owner:"organizer"});
const school=campaign("lop-hoc","Quảng Nam"), other=campaign("noi-khac","Đà Nẵng"), closed=campaign("da-dong","Quảng Nam","closed");
const need=(c:Campaign,id:number,unit="bộ"):Need=>({id,slug:c.slug,name:"Dụng cụ học tập",unit,topic:"learning",handoff:"Điểm nhận",target:25,received:15,pledged:2});
const shift=(id:number,startsAt:string,changes:Partial<VolunteerShift>={}):VolunteerShift=>({id,startsAt,slug:school.slug,title:"Phụ đóng gói",location:"Điểm nhận",capacity:5,reserved:2,...changes});

test("chỉ trả dữ liệu mở, khớp khu vực và thời gian, gợi ý số thực sự còn nhận",()=>{
  const intent=parse("Mình có 15 bộ dụng cụ học tập ở Quảng Nam, rảnh sáng Chủ nhật để phụ đóng gói hoặc góp 200k");
  const result=assistMatches(intent.filters,[school,other,closed],[need(school,1),need(other,2),need(closed,3),need(school,4,"quyển")],[
    shift(1,"2026-11-29T02:00:00Z"),shift(2,"2026-11-28T02:00:00Z"),shift(3,"2026-11-29T07:00:00Z"),
    shift(4,"2026-11-29T02:00:00Z",{reserved:5}),shift(5,"2026-11-29T02:00:00Z",{slug:other.slug}),shift(6,"2026-11-29T02:00:00Z",{slug:closed.slug}),
    shift(7,"2026-11-22T02:00:00Z"),shift(8,"2026-11-29T02:00:00Z",{title:"Dọn vệ sinh"}),
  ],now);
  assert.deepEqual(result.goods.map(item=>[item.id,item.available,item.requested,item.suggested]),[[1,8,15,8]]);
  assert.deepEqual(result.volunteer.map(item=>[item.id,item.available]),[[1,3]]);
  assert.deepEqual(result.cash.map(item=>[item.campaign.slug,item.remaining,item.amount]),[[school.slug,80_000,200_000]]);
  assert.ok(!("owner" in result.cash[0].campaign));
});

test("không thả lỏng lịch khi chưa làm rõ và dùng điều kiện đã sửa khi tìm lại",()=>{
  const c=campaign("lop-hoc","Quảng Nam"), slots=[shift(1,"2026-11-28T02:00:00Z"),shift(2,"2026-11-29T02:00:00Z")];
  const intent=parse("Mình muốn đi tình nguyện thứ Bảy hoặc Chủ nhật");
  assert.equal(intent.needsTime,true);
  assert.equal(assistMatches(intent.filters,[c],[],slots,now,intent.needsTime).volunteer.length,0);
  const edited={...emptyAssistFilters,modes:["volunteer" as const],date:"2026-11-29"};
  assert.deepEqual(assistMatches(edited,[c],[],slots,now).volunteer.map(item=>item.id),[2]);
});

test("chỉ gợi ý bỏ khu vực khi có đúng nhóm và đơn vị ở nơi khác",()=>{
  const {filters}=parse("Mình có 15 bộ dụng cụ học tập và 3 chiếc chăn ở Quảng Nam");
  const blanket={...need(other,20,"chiếc"),topic:"blankets" as const};
  const rows=[need(school,1,"quyển"),need(other,2),need(closed,3),blanket];
  const result=resolveAssist(filters,[school,other,closed],rows,[],now);
  assert.deepEqual(result.goods,[]);
  assert.deepEqual(result.gaps.map(gap=>[gap.topic,gap.reason,gap.alternatives.map(option=>option.change)]),[
    ["learning","unit",["area"]],["blankets","unavailable",["area"]],
  ]);
  const alternate=alternativeFilters(filters,result.gaps[0].alternatives[0]);
  assert.equal(alternate.location,"");
  assert.deepEqual(alternate.items,[{topic:"learning",quantity:15,unit:"bộ"}]);
  assert.deepEqual(resolveAssist(alternate,[school,other,closed],rows,[],now).goods.map(({id,suggested})=>[id,suggested]),[[2,8]]);
  assert.equal(filters.location,"Quảng Nam");
  assert.deepEqual(resolveAssist(filters,[school,closed],[need(school,1,"quyển"),need(closed,3)],[],now).gaps[0].alternatives,[]);
});

test("nhiều kết quả cùng nhóm không lấp mất kết quả hoặc thông báo của nhóm khác",()=>{
  const {filters}=parse("Mình có gạo, chăn bông và 15 bộ dụng cụ học tập ở Quảng Nam");
  const learning=Array.from({length:7},(_,i)=>({...need(school,i+1),target:100-i}));
  const blankets={...need(school,20,"chiếc"),topic:"blankets" as const};
  const result=resolveAssist(filters,[school],[...learning,blankets],[],now);
  assert.equal(result.goods.length,5);
  assert.deepEqual(result.goods.slice(0,2).map(item=>item.topic),["learning","blankets"]);
  assert.deepEqual(result.gaps.map(gap=>gap.topic),["food"]);
});

test("chỉ gợi ý lịch hoặc công việc khác nếu đổi riêng điều kiện đó là đủ",()=>{
  const {filters}=parse("Tôi muốn phụ đóng gói sáng Chủ nhật ở Quảng Nam");
  const saturday=shift(1,"2026-11-28T02:00:00Z"), otherTask=shift(2,"2026-11-29T02:00:00Z",{title:"Dọn vệ sinh"});
  const elsewhere=shift(3,"2026-11-29T02:00:00Z",{slug:other.slug,reserved:5});
  const result=resolveAssist(filters,[school,other,closed],[],[saturday,otherTask,elsewhere],now);
  assert.deepEqual(result.volunteer,[]);
  assert.deepEqual(result.gaps[0].alternatives.map(item=>item.change),["schedule","role"]);
  const schedule=alternativeFilters(filters,result.gaps[0].alternatives[0]);
  assert.equal(schedule.role,"đóng gói");
  assert.equal(schedule.location,"Quảng Nam");
  assert.deepEqual(resolveAssist(schedule,[school,other],[],[saturday,otherTask,elsewhere],now).volunteer.map(item=>item.id),[1]);
  const role=alternativeFilters(filters,result.gaps[0].alternatives[1]);
  assert.equal(role.day,"sun");
  assert.equal(role.part,"morning");
  assert.deepEqual(resolveAssist(role,[school,other],[],[saturday,otherTask,elsewhere],now).volunteer.map(item=>item.id),[2]);
  assert.deepEqual(resolveAssist(filters,[school],[],[saturday],now,true).gaps,[]);
});
