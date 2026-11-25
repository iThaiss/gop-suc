import { money, type Campaign, type Need, type Role, type VolunteerShift } from "./domain.ts";

const hours48=48*60*60*1000;
export const canManageCampaign=(role:Role,campaign:Pick<Campaign,"owner">)=>role==="admin"||campaign.owner===role;

export function coordinationTasks(role:Role,campaigns:Campaign[],counts:Map<string,number>,shifts:VolunteerShift[],now=Date.now()) {
  const visible=campaigns.filter(campaign=>canManageCampaign(role,campaign));
  const active=new Map(visible.filter(campaign=>campaign.status==="active").map(campaign=>[campaign.slug,campaign]));
  const handoff=visible.flatMap(campaign=>{
    const pending=counts.get(campaign.slug)??0;
    return pending>0&&campaign.status!=="draft"?[{campaign,pending}]:[];
  }).sort((a,b)=>b.pending-a.pending||a.campaign.slug.localeCompare(b.campaign.slug));
  const shortShifts=shifts.flatMap(shift=>{
    const campaign=active.get(shift.slug), start=Date.parse(shift.startsAt), open=Math.max(0,shift.capacity-shift.reserved);
    if(!campaign||!Number.isFinite(start)||start<=now||start>now+hours48||!open||10*open<3*shift.capacity) return [];
    return [{campaign,shift,open,hours:Math.ceil((start-now)/3600000)}];
  }).sort((a,b)=>Date.parse(a.shift.startsAt)-Date.parse(b.shift.startsAt)||b.open-a.open);
  const review=visible.filter(campaign=>campaign.status==="draft");
  return {handoff,shortShifts,review};
}

export function journalDraft(campaign:Pick<Campaign,"received"|"spent">,inventory:Need[]) {
  const sentence=[`Theo sổ thu chi mô phỏng, chiến dịch đã ghi nhận ${money(campaign.received)} và đã chi ${money(campaign.spent)}.`];
  const items=inventory.filter(need=>need.received>0||need.pledged>0).slice(0,3);
  if(items.length) {
    const lines=items.map(({name,unit,received,pledged})=>`- ${name}: đã nhận ${received} ${unit}, đang hẹn giao ${pledged} ${unit}.`);
    sentence.push("Tình hình tiếp nhận hiện vật:",lines.join("\n"));
  }
  return {title:"Cập nhật tiến độ tiếp nhận và thu chi",body:sentence.join("\n\n")};
}
