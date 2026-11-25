import { CalendarPlus } from "lucide-react";
import { shiftCalendarPath } from "../lib/domain";

export function CalendarLink({slug,shiftId}: {slug:string;shiftId:number}) {
  return <div className="calendar-link">
    <a className="button outline" href={shiftCalendarPath(slug,shiftId)} download><CalendarPlus size={18} aria-hidden="true"/> Thêm vào lịch</a>
    <small>Mở tệp .ics trong ứng dụng Lịch. Nếu hủy ca, hãy xóa lịch đã lưu.</small>
  </div>;
}
