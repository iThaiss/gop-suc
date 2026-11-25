import { createHash } from "node:crypto";
import { db } from "./db";
import type { Role } from "./domain";

export const sessionCookie = "gopsuc_session";
export const hash = (value: string) => createHash("sha256").update(value).digest();

export function sessionRole(value: string | undefined): Role | null {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  const row = db().prepare("SELECT role FROM sessions WHERE token=? AND until>?").get(hash(value).toString("hex"),Date.now());
  return row?.role === "admin" || row?.role === "organizer" ? row.role : null;
}
