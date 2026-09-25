import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
export function sessionToken(shopId: string, sessionId?: string) {
  return encryptSecret(
    JSON.stringify({ shopId, sessionId, expires: Date.now() + 86400000 }),
  );
}
export async function requireShop(domain?: string) {
  let id: string | undefined;
  try {
    const token = (await cookies()).get("stockify_session")?.value;
    if (token) {
      const s = JSON.parse(decryptSecret(token));
      if (s.expires > Date.now()) id = s.shopId;
    }
  } catch {}
  if (!id) redirect("/?error=session_expired");
  const shop = await db.shop.findUnique({ where: { id } });
  if (!shop || shop.status !== "ACTIVE" || (domain && shop.domain !== domain))
    redirect("/?error=unauthorized");
  return shop;
}

export async function currentSessionId(): Promise<string | undefined> {
  try {
    const token = (await cookies()).get("stockify_session")?.value;
    if (!token) return;
    const s = JSON.parse(decryptSecret(token));
    if (s.expires > Date.now() && typeof s.sessionId === "string")
      return s.sessionId;
  } catch {}
}
