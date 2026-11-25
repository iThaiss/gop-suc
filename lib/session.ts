import { createHash } from "node:crypto";
import { get } from "./db";
import type { Role } from "./domain";

export const sessionCookie = "gopsuc_session";
export const hash = (value: string) => createHash("sha256").update(value).digest();

export async function sessionRole(value: string | undefined): Promise<Role | null> {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  const row = await get("SELECT role FROM sessions WHERE token=? AND until>?",hash(value).toString("hex"),Date.now());
  return row?.role === "admin" || row?.role === "organizer" ? row.role : null;
}
