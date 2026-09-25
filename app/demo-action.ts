"use server";
import { randomUUID } from "node:crypto";
import { logConnection } from "@/lib/audit";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoEnabled, DEMO_SHOP_ID } from "@/lib/demo";
import { db } from "@/lib/db";
import { sessionToken } from "@/lib/session";
export async function openDemo() {
  if (!demoEnabled()) throw new Error("Démonstration indisponible");
  const shop = await db.shop.findUniqueOrThrow({ where: { id: DEMO_SHOP_ID } });
  const sid = randomUUID();
  await logConnection(shop.id, sid, true);
  (await cookies()).set("stockify_session", sessionToken(shop.id, sid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
    secure: false,
  });
  redirect("/inventory");
}
