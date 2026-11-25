export const categories = ["Giáo dục", "Thực phẩm", "Cứu trợ"] as const;
export const covers = ["school", "meals", "relief"] as const;
export type Role = "admin" | "organizer";
export type Campaign = {
  slug: string; title: string; description: string; category: string; location: string;
  cover: string; goal: number; status: "draft" | "active" | "closed"; owner: string;
  received: number; spent: number;
};
export type Need = {
  id: number; slug: string; name: string; unit: string; target: number; received: number;
  pledged: number; handoff: string; topic: string;
};
export type Update = { id: number; slug: string; title: string; body: string; image: string; created: string; hasPhoto: number };
export type CampaignImpact = Pick<Campaign, "slug" | "title" | "status" | "received" | "spent" | "goal"> & {
  updates: Pick<Update, "id" | "title" | "created">[];
};
export type Expense = { id: number; title: string; amount: number; evidence: string; created: string };
export type Receipt = {
  code: string; slug: string; kind: "cash" | "goods"; amount: number;
  status: "pending" | "confirmed" | "cancelled"; actual: number | null;
  needId: number | null; needName: string | null; unit: string | null; handoff: string | null;
};
export type VolunteerShift = {id:number;slug:string;title:string;location:string;startsAt:string;capacity:number;reserved:number};
export type VolunteerBooking = {code:string;slug:string;title:string;location:string;startsAt:string;status:"booked"|"cancelled"};
export function vietnamTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(iso));
}
export const money = (n: number) => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND"}).format(n);
export const picture = (cover: string) => covers.includes(cover as typeof covers[number]) ? `/photos/${cover}.webp` : "/photos/school.webp";
export const updatePicture = (post: Update) => post.hasPhoto ? `/api/gopsuc/photos/${post.slug}/${post.id}` : post.image ? picture(post.image) : undefined;
export const UPDATE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export function updateDate(created: string) {
  const date = new Date(created.replace(" ","T")+"Z");
  return new Intl.DateTimeFormat("vi-VN",{dateStyle:"long",timeZone:"Asia/Ho_Chi_Minh"}).format(date);
}
export const publicBase = () => process.env.SITE_URL || "http://localhost:3100";
