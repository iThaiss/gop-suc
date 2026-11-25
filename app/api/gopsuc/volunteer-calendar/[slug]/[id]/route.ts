import { volunteerCalendar } from "../../../../../../lib/calendar";
import { publicVolunteerCalendar } from "../../../../../../lib/db";
import { publicBase } from "../../../../../../lib/domain";

export const dynamic="force-dynamic";

export async function GET(_:Request,{params}:{params:Promise<{slug:string;id:string}>}) {
  const {slug,id}=await params;
  const noStore={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
  const unavailable=()=>new Response(null,{status:404,headers:noStore});
  if(slug.length>70||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!/^[1-9]\d{0,9}$/.test(id)||Number(id)>2_147_483_647) return unavailable();
  const shift=await publicVolunteerCalendar(slug,Number(id));
  if(!shift||!Number.isFinite(Date.parse(shift.startsAt))||Date.parse(shift.startsAt)<=Date.now()) return unavailable();
  return new Response(volunteerCalendar(shift,publicBase()),{headers:{...noStore,
    "Content-Type":"text/calendar; charset=utf-8",
    "Content-Disposition":`attachment; filename="gop-suc-ca-${shift.id}.ics"`,
  }});
}
