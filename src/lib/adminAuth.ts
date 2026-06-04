import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

function sessionSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET ist nicht gesetzt.");
  return s;
}

/** Konstantzeit-Vergleich gegen ADMIN_PASSWORD. */
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(data: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

function createSessionValue(): string {
  const b64 = Buffer.from(JSON.stringify({ iat: Date.now() })).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const [b64, sig] = value.split(".");
  if (!b64 || !sig) return false;
  const expected = sign(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { iat } = JSON.parse(Buffer.from(b64, "base64url").toString());
    return typeof iat === "number" && Date.now() - iat < MAX_AGE * 1000;
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE)?.value);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
