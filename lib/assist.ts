import type { Campaign, Need, VolunteerShift } from "./domain.ts";
import { classify, normalize, quantityIntent, unitGroup } from "./match.ts";

export const giveModes=["goods","volunteer","cash"] as const;
export const goodsTopics=["learning","cleaning","food","blankets"] as const;
export const days=["any","today","tomorrow","weekend","mon","tue","wed","thu","fri","sat","sun"] as const;
export const parts=["any","morning","afternoon","evening"] as const;
export const units=["", "bộ","kg","chiếc","quyển"] as const;
const unitMap:Record<string,typeof units[number]>={set:"bộ",weight:"kg",piece:"chiếc",book:"quyển"};
export type AssistFilters={
  modes:(typeof giveModes[number])[]; location:string; day:typeof days[number]; date:string; part:typeof parts[number]; role:string;
  items:{topic:typeof goodsTopics[number];quantity:number|null;unit:typeof units[number]}[]; money:number|null;
};
type GiveMode=AssistFilters["modes"][number];
type GoodsTopic=AssistFilters["items"][number]["topic"];
type Relaxation="area"|"schedule"|"role";
export type AssistAlternative={mode:GiveMode;topic?:GoodsTopic;change:Relaxation};
type AssistGap={mode:GiveMode;topic?:GoodsTopic;reason:"no-item"|"unit"|"unavailable";alternatives:AssistAlternative[]};
export const emptyAssistFilters:AssistFilters={modes:[],location:"",day:"any",date:"",part:"any",role:"",items:[],money:null};
const places=["Đà Nẵng","Quảng Nam","Huế","Hà Nội","Cần Thơ","Hồ Chí Minh","Sài Gòn","Quảng Trị","Quảng Ngãi","Hải Phòng","Cầu Giấy"];
const volunteerWords=/\b(tinh nguyen|toi ranh|minh ranh|minh co the phu|di phu|phu bep|phat com|dong goi|ho tro truc tiep|gop thoi gian|ca nao|ca nao con|ca tinh nguyen)\b/;
const volunteerRoles=[{expr:/\b(phu bep|nau bep|nau an)\b/,label:"bếp"},{expr:/\bphat com\b/,label:"phát cơm"},{expr:/\bdong goi\b/,label:"đóng gói"}];
const absent=/\b(khong co|khong muon|khong the|khong ranh|chua co|khong gop|khong gui|khong chuyen)\b/;
const ambiguousTime=/\b(tuan sau|ngay kia|tuan toi|thang sau|\d+ gio)\b|\b\d{1,2}[:h]\d{0,2}\b/;
const dayWords:Record<Exclude<AssistFilters["day"],"any">,RegExp>={
  today:/\b(hom nay|bay gio)\b/,tomorrow:/\b(ngay mai|sang mai|chieu mai|toi mai|mai)\b/,weekend:/\bcuoi tuan\b/,
  mon:/\bthu (2|hai)\b/,tue:/\bthu (3|ba)\b/,wed:/\bthu (4|tu)\b/,thu:/\bthu (5|nam)\b/,fri:/\bthu (6|sau)\b/,
  sat:/\bthu (7|bay)\b/,sun:/\b(chu nhat|cn)\b/,
};
const directPart={morning:/\bsang\b/,afternoon:/\bchieu\b/,evening:/\btoi\b(?=\s+(chu nhat|cn|thu|mai|nay|cuoi tuan|hom nay)|$)/};
const words=(value:string)=>normalize(value).replace(/[^a-z0-9]+/g," ").trim();
function contains(haystack:string,needle:string) {
  const query=words(needle);
  return !needle.trim() || Boolean(query&&` ${words(haystack)} `.includes(` ${query} `));
}

function moneyIntent(text:string) {
  const values=[...text.matchAll(/(?<![\d.,-])([1-9]\d{0,8}(?:[.,]\d{1,3})?)\s*(k|nghin|ngan|canh|trieu|vnd|dong|₫|đ)(?![a-z])/g)];
  if(values.length!==1 || /\d\s*(?:[-–]|den|toi)\s*\d/.test(text)) return null;
  const [,digits,unit]=values[0];
  const multiplier=unit==="trieu"?1_000_000:["k","nghin","ngan","canh"].includes(unit)?1000:1;
  const resolved=multiplier===1&&/^\d+[.,]\d{3}$/.test(digits)?digits.replace(/[.,]/g,""):digits.replace(",",".");
  const amount=Number(resolved)*multiplier;
  return Number.isInteger(amount)&&amount>=1000&&amount<=1_000_000_000?amount:null;
}

export function validDay(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().startsWith(value);
}
function exactDay(text:string, now:number) {
  const explicit=[...text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)];
  if (!explicit.length) return {date:"",unclear:false};
  if (explicit.length!==1) return {date:"",unclear:true};
  const [,day,month,namedYear]=explicit[0];
  const today=new Date(vnDay(now)*dayMs).toISOString().slice(0,10);
  const year=Number(namedYear??today.slice(0,4));
  const iso=(y:number)=>`${y}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`;
  let date=iso(year);
  if(!namedYear&&date<today) date=iso(year+1);
  return validDay(date)?{date,unclear:false}:{date:"",unclear:true};
}

export function parseAssist(query:string, locations:string[]=[], now=Date.now()): {filters:AssistFilters;notes:string[];needsTime:boolean} {
  const plain=normalize(query).replace(/\s+/g," ").trim();
  const chunks=plain.split(/(?<!\d),|,(?!\d)|[;!?]|\b(?:va|hoac|nhung|con minh)\b/).map(x=>x.trim()).filter(Boolean);
  const eligible=chunks.filter(x=>!absent.test(x));
  const text=eligible.join(" ; ");
  const items:AssistFilters["items"]=[];
  const notes:string[]=[];
  const clashes=new Set<string>();
  const explicitMoney=eligible.some(x=>/\b(chuyen khoan|gop tien|ung ho tien|gop quy|kinh phi)\b/.test(x)||moneyIntent(x)!==null);
  const volunteer=volunteerWords.test(text)||/\b(ranh|phu)\s+(sang|chieu|toi|thu|chu nhat|cuoi tuan|ngay|hom|vao)\b/.test(text);
  for(const chunk of eligible) {
    const strongest=classify(chunk)[0];
    if(!strongest||strongest.id==="money"||strongest.score<0.28) continue;
    if (/\b(may tinh|piano|dien thoai|tivi|tu lanh|xe dap)\b/.test(chunk) && !quantityIntent(chunk)) continue;
    const parsed=quantityIntent(chunk);
    const next={topic:strongest.id,quantity:parsed?.topic===strongest.id?parsed.amount:null,unit:parsed?.topic===strongest.id?unitMap[parsed.unit??""]??"":""} as AssistFilters["items"][number];
    const previous=items.find(item=>item.topic===next.topic);
    if(!previous) items.push(next);
    else if(previous.quantity!==null&&next.quantity!==null) {previous.quantity=null;previous.unit="";clashes.add(next.topic);}
    else if(next.quantity!==null&&!clashes.has(next.topic)) Object.assign(previous,next);
  }
  if(clashes.size) notes.push("Có nhiều số lượng cho cùng một nhóm. Bạn có thể điền lại số muốn góp.");
  if(items.some(item=>item.quantity===null)&&/\d\s*(?:[-–]|den)\s*\d/.test(text)) notes.push("Chưa điền số lượng vì bạn đưa ra một khoảng.");
  const named=[...new Set([...locations,...places])].filter(place=>contains(text,place)).sort((a,b)=>b.length-a.length)[0];
  const unknown = text.match(/\b(?:o|tai|khu vuc|gan)\s+([a-z][a-z0-9 ]{1,58}?)(?=\s+(?:muon|co|de|can|gop|gui|tang|ranh|phu|vao|sang|chieu|toi|thu|cn|chu nhat|cuoi tuan)\b|\s*;|$)/)?.[1]?.trim();
  const dayHits=Object.entries(dayWords).filter(([,expr])=>expr.test(text)).map(([day])=>day as AssistFilters["day"]);
  const partHits=Object.entries(directPart).filter(([,expr])=>expr.test(text)).map(([part])=>part as AssistFilters["part"]);
  const date=exactDay(text,now);
  const needsTime=volunteer&&(date.unclear||ambiguousTime.test(text)||(!date.date&&dayHits.length>1)||partHits.length>1);
  if(needsTime) notes.push("Hãy chọn một ngày hoặc buổi cụ thể trước khi tìm ca tình nguyện.");
  if(absent.test(plain)&&!eligible.length) notes.push("Bạn chưa chọn cách muốn góp. Có thể chọn ở bên dưới.");
  const modes:AssistFilters["modes"]=[];
  if(items.length) modes.push("goods");
  if(volunteer) modes.push("volunteer");
  if(explicitMoney) modes.push("cash");
  const amounts=eligible.map(moneyIntent).filter((value):value is number=>value!==null);
  return {filters:{modes,location:(named??unknown??"").slice(0,60),day:needsTime||date.date?"any":dayHits[0]??"any",date:date.date,part:partHits.length===1?partHits[0]:"any",role:volunteerRoles.find(job=>job.expr.test(text))?.label??"",items:items.slice(0,4),money:amounts.length===1?amounts[0]:null},notes,needsTime};
}

const weekday: AssistFilters["day"][]=["sun","mon","tue","wed","thu","fri","sat"];
const dayMs=86400000;
function vnDay(ms:number) {return Math.floor((ms+7*3600000)/dayMs);}
function fitsTime(startsAt:number, now:number, filters:AssistFilters) {
  const base=vnDay(now), date=vnDay(startsAt);
  const diff=date-base;
  const dayIndex=new Date(base*dayMs).getUTCDay();
  const firstSat=(6-dayIndex+7)%7;
  const valid=filters.date ? date===Math.floor(Date.parse(`${filters.date}T00:00:00Z`)/dayMs) : filters.day==="any" || (filters.day==="today"&&diff===0) || (filters.day==="tomorrow"&&diff===1)
    || (filters.day==="weekend"&&(dayIndex===0?diff===0:diff===firstSat||diff===firstSat+1))
    || (weekday.includes(filters.day)&&diff===(weekday.indexOf(filters.day)-dayIndex+7)%7);
  const hour=new Date(startsAt+7*3600000).getUTCHours();
  return valid&&(filters.part==="any"||(filters.part==="morning"&&hour>=5&&hour<12)||(filters.part==="afternoon"&&hour>=12&&hour<18)||(filters.part==="evening"&&hour>=18));
}

type PublicCampaign=Pick<Campaign,"slug"|"title"|"location">;
export function assistMatches(filters:AssistFilters, campaigns:Campaign[], needs:Need[], shifts:VolunteerShift[], now=Date.now(), needsTime=false) {
  const active=new Map(campaigns.filter(c=>c.status==="active").map(c=>[c.slug,c]));
  const expose=({slug,title,location}:Campaign):PublicCampaign=>({slug,title,location});
  const here=(campaign:Campaign)=>contains(campaign.location,filters.location);
  const goods=filters.modes.includes("goods")&&filters.items.length ? needs.flatMap(need=>{
    const campaign=active.get(need.slug), selected=filters.items.find(item=>item.topic===need.topic);
    const available=need.target-need.received-need.pledged;
    if(!campaign||!here(campaign)||!selected||available<=0) return [];
    const unitMatches=!selected.unit||unitGroup(need.unit)===unitGroup(selected.unit);
    // A requested unit is a constraint; never turn, for example, 15 notebooks into 15 kits.
    if(!unitMatches) return [];
    const requested=selected.quantity&&selected.unit?selected.quantity:null;
    return [{id:need.id,topic:selected.topic,name:need.name,unit:need.unit,handoff:need.handoff,available,requested,suggested:requested?Math.min(requested,available):null,campaign:expose(campaign)}];
  }).sort((a,b)=>Number(b.requested!==null&&b.suggested===b.requested)-Number(a.requested!==null&&a.suggested===a.requested)||b.available-a.available):[];
  // Keep room for at least one result per requested topic before filling the list.
  const bestByTopic=new Map<GoodsTopic,(typeof goods)[number]>();
  for(const item of goods) if(!bestByTopic.has(item.topic)) bestByTopic.set(item.topic,item);
  const volunteer=filters.modes.includes("volunteer")&&!needsTime ? shifts.flatMap(shift=>{
    const campaign=active.get(shift.slug), available=shift.capacity-shift.reserved, time=Date.parse(shift.startsAt);
    if(!campaign||available<=0||!Number.isFinite(time)||time<=now||!fitsTime(time,now,filters)||(!here(campaign)&&!contains(shift.location,filters.location))||!contains(shift.title,filters.role)) return [];
    return [{id:shift.id,title:shift.title,location:shift.location,startsAt:shift.startsAt,available,campaign:expose(campaign)}];
  }).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,4):[];
  const cash=filters.modes.includes("cash") ? [...active.values()].filter(here).sort((a,b)=>a.received/a.goal-b.received/b.goal).slice(0,3)
    .map(campaign=>({campaign:expose(campaign),remaining:Math.max(0,campaign.goal-campaign.received),amount:filters.money})):[];
  return {goods:[...bestByTopic.values(),...goods.filter(item=>bestByTopic.get(item.topic)!==item)].slice(0,5),volunteer,cash};
}

export function alternativeFilters(filters:AssistFilters, alternative:AssistAlternative):AssistFilters {
  const next={...filters,modes:[alternative.mode]};
  if(alternative.topic) next.items=filters.items.filter(item=>item.topic===alternative.topic);
  if(alternative.change==="area") next.location="";
  if(alternative.change==="schedule") {next.day="any";next.date="";next.part="any";}
  if(alternative.change==="role") next.role="";
  return next;
}

export function resolveAssist(filters:AssistFilters, campaigns:Campaign[], needs:Need[], shifts:VolunteerShift[], now=Date.now(), needsTime=false) {
  const match=(candidate:AssistFilters)=>assistMatches(candidate,campaigns,needs,shifts,now,needsTime);
  const results=match(filters);
  const gaps:AssistGap[]=[];
  function gap(mode:GiveMode,opts:{topic?:GoodsTopic;reason?:AssistGap["reason"];changes?:Relaxation[]}={}) {
    const alternatives=(opts.changes??[]).map(change=>({mode,topic:opts.topic,change}))
      .filter(candidate=>match(alternativeFilters(filters,candidate))[mode].length>0);
    gaps.push({mode,topic:opts.topic,reason:opts.reason??"unavailable",alternatives});
  }
  const anyArea:Relaxation[]=filters.location.trim()?["area"]:[];

  if(filters.modes.includes("goods")) {
    if(!filters.items.length) gap("goods",{reason:"no-item"});
    for(const item of filters.items) {
      if(results.goods.some(found=>found.topic===item.topic)) continue;
      // Detect a mismatched unit for the explanation only. Never offer it as a match.
      const otherUnit=item.unit&&match({...filters,modes:["goods"],items:[{...item,unit:"",quantity:null}]}).goods.length>0;
      gap("goods",{topic:item.topic,reason:otherUnit?"unit":"unavailable",changes:anyArea});
    }
  }
  if(filters.modes.includes("volunteer")&&!needsTime&&!results.volunteer.length) {
    const schedule=filters.date||filters.day!=="any"||filters.part!=="any";
    gap("volunteer",{changes:[...anyArea,...(schedule?["schedule" as const]:[]),...(filters.role.trim()?["role" as const]:[])]});
  }
  if(filters.modes.includes("cash")&&!results.cash.length) gap("cash",{changes:anyArea});
  return {...results,gaps};
}
export type AssistResult=ReturnType<typeof resolveAssist> & {filters:AssistFilters;notes:string[];needsTime:boolean};
