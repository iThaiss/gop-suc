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
export type Update = { id: number; slug: string; title: string; body: string; image: string; created: string };
export type Expense = { id: number; title: string; amount: number; evidence: string; created: string };
export type Receipt = {
  code: string; slug: string; kind: "cash" | "goods"; amount: number;
  status: "pending" | "confirmed" | "cancelled"; actual: number | null;
  needId: number | null; needName: string | null; unit: string | null; handoff: string | null;
};
export const money = (n: number) => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND"}).format(n);
export const picture = (cover: string) => covers.includes(cover as typeof covers[number]) ? `/photos/${cover}.webp` : "/photos/school.webp";
export const publicBase = () => process.env.SITE_URL || "http://localhost:3100";
