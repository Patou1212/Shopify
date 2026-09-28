import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
export const saasEnabled = () => process.env.STOCKIFY_SAAS === "true";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256)
    throw new Error("Utilisez entre 12 et 256 caractères.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, encoded: string) {
  if (password.length > 256) return false;
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(hash, "hex"),
  );
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400,
};
export async function accountSession() {
  if (!saasEnabled()) return null;
  const raw = (await cookies()).get("stockify_account")?.value;
  if (!raw) return null;
  const session = await db.accountSession.findUnique({
    where: { tokenHash: digest(raw) },
    include: { account: true },
  });
  return session && session.expiresAt > new Date() && !session.account.disabled
    ? session
    : null;
}
export async function requireAccount() {
  const session = await accountSession();
  if (!session) redirect("/account/login");
  return session;
}
export async function requireWorkspace(
  id: string,
  roles = ["OWNER", "MANAGER", "VIEWER"],
) {
  const session = await requireAccount();
  const member = await db.membership.findUnique({
    where: {
      accountId_workspaceId: { accountId: session.accountId, workspaceId: id },
    },
    include: { workspace: true },
  });
  if (!member || member.workspace.suspended || !roles.includes(member.role))
    throw new Error("Accès à cet espace non autorisé.");
  return { session, member };
}
export async function requireAdmin() {
  const session = await requireAccount();
  if (!session.account.platformAdmin) redirect("/account");
  return session;
}
export async function createSession(accountId: string) {
  const token = newToken();
  await db.accountSession.create({
    data: {
      accountId,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  (await cookies()).set("stockify_account", token, cookieOptions);
}
export async function throttle(key: string) {
  // Atomic fixed window: all application instances share the same budget.
  const window = Math.floor(Date.now() / 900000);
  const row = await db.authThrottle.upsert({
    where: { key: digest(`${key}:${window}`) },
    create: {
      key: digest(`${key}:${window}`),
      attempts: 1,
      resetAt: new Date((window + 1) * 900000),
    },
    update: { attempts: { increment: 1 } },
  });
  return row.attempts <= 10;
}
