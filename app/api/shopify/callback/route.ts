import { randomUUID } from "node:crypto";
import { logConnection } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { SHOPIFY_API_VERSION } from "@/lib/shopify/config";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/domain";
import { exchangeCodeForToken, verifyOAuthHmac } from "@/lib/shopify/oauth";
import { shopifyGraphql } from "@/lib/shopify/graphql";

import { sessionToken } from "@/lib/session";

const QUERY = `query { shop { id name myshopifyDomain } }`;
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const shop = normalizeShopDomain(p.get("shop") ?? "");
  const code = p.get("code") ?? "";
  const state = p.get("state") ?? "";
  if (
    !isValidShopDomain(shop) ||
    shop !== request.cookies.get("stockify_oauth_shop")?.value
  )
    return NextResponse.redirect(new URL("/?error=shop_mismatch", request.url));
  if (!state || state !== request.cookies.get("stockify_oauth_state")?.value)
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  if (!verifyOAuthHmac(p) || !code)
    return NextResponse.redirect(
      new URL("/?error=invalid_callback", request.url),
    );
  try {
    const token = await exchangeCodeForToken(shop, code);
    const stored = await db.shop.upsert({
      where: { domain: shop },
      create: {
        domain: shop,
        encryptedAccessToken: encryptSecret(token.accessToken),
        grantedScopes: token.scope,
        apiVersion: SHOPIFY_API_VERSION,
      },
      update: {
        encryptedAccessToken: encryptSecret(token.accessToken),
        grantedScopes: token.scope,
        apiVersion: SHOPIFY_API_VERSION,
        status: "ACTIVE",
        connectedAt: new Date(),
      },
    });
    const identity = await shopifyGraphql<{
      shop: { id: string; name: string };
    }>(stored, QUERY);
    await db.shop.update({
      where: { id: stored.id },
      data: { name: identity.shop.name, shopifyShopId: identity.shop.id },
    });
    const response = NextResponse.redirect(
      new URL(`/dashboard?shop=${encodeURIComponent(shop)}`, request.url),
    );
    const sid = randomUUID();
    await logConnection(stored.id, sid, false);
    response.cookies.set("stockify_session", sessionToken(stored.id, sid), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    response.cookies.delete("stockify_oauth_state");
    response.cookies.delete("stockify_oauth_shop");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
