import type { VolunteerShift } from "./domain.ts";

type CalendarShift=Pick<VolunteerShift,"id"|"slug"|"title"|"location"|"startsAt">;
function escapeText(value:string) {
  return value.replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/[,;]/g,token=>`\\${token}`).replace(/[\u0000-\u001f\u007f]/g," ");
}
function fold(line:string) {
  let bytes=0,result="";
  for(const point of line) {
    const length=Buffer.byteLength(point,"utf8");
    if(bytes+length>75) {result+="\r\n ";bytes=1;}
    result+=point;
    bytes+=length;
  }
  return result;
}
function utcDate(date:Date) {
  return date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
}

export function volunteerCalendar(shift:CalendarShift,site:string,stamp=new Date()) {
  const start=new Date(shift.startsAt);
  const origin=new URL(site).origin;
  const campaignUrl=new URL(`/chien-dich/${encodeURIComponent(shift.slug)}#tinh-nguyen`,origin);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gop Suc//Lich tinh nguyen//VI", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:ca-${shift.id}-${shift.slug}@${campaignUrl.hostname}`,
    `DTSTAMP:${utcDate(stamp)}`, `DTSTART:${utcDate(start)}`,
    `SUMMARY:${escapeText(shift.title)} · Góp Sức`, `LOCATION:${escapeText(shift.location)}`,
    `DESCRIPTION:${escapeText(`Lịch ca tình nguyện công khai. Giờ ghi trong lịch là giờ bắt đầu. Tệp lịch không xác nhận giữ chỗ.\nXem chiến dịch: ${campaignUrl.href}`)}`,
    `URL:${campaignUrl.href}`, "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join("\r\n")+"\r\n";
}
