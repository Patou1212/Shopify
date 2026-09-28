import { saasEnabled, requireAccount, requireWorkspace } from "@/lib/account";
import { linkShop } from "@/lib/tenant";
import { requireShopifyConfig } from "@/lib/shopify/config";
import { randomUUID } from "node:crypto";
import { logConnection } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
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
    return NextResponse.redirect(
      new URL("/?error=shop_mismatch", requireShopifyConfig().appUrl),
    );
  if (!state || state !== request.cookies.get("stockify_oauth_state")?.value)
    return NextResponse.redirect(
      new URL("/?error=invalid_state", requireShopifyConfig().appUrl),
    );
  if (!verifyOAuthHmac(p) || !code)
    return NextResponse.redirect(
      new URL("/?error=invalid_callback", requireShopifyConfig().appUrl),
    );
  try {
    let binding: { workspaceId: string; accountId: string } | undefined;
    if (saasEnabled()) {
      const session = await requireAccount();
      const value = JSON.parse(
        decryptSecret(
          request.cookies.get("stockify_oauth_account")?.value || "",
        ),
      );
      if (
        value.sessionId !== session.id ||
        value.accountId !== session.accountId ||
        value.shop !== shop ||
        value.state !== state ||
        !(value.expires > Date.now())
      )
        throw new Error("OAuth account mismatch");
      await requireWorkspace(value.workspaceId, ["OWNER"]);
      binding = value;
    }
    const token = await exchangeCodeForToken(shop, code);
    const identity = await shopifyGraphql<{
      shop: { id: string; name: string; myshopifyDomain: string };
    }>(
      {
        id: "oauth",
        domain: shop,
        apiVersion: SHOPIFY_API_VERSION,
        encryptedAccessToken: encryptSecret(token.accessToken),
      },
      QUERY,
    );
    const stored = binding
      ? await linkShop({
          workspaceId: binding.workspaceId,
          accountId: binding.accountId,
          domain: identity.shop.myshopifyDomain,
          shopifyId: identity.shop.id,
          name: identity.shop.name,
          accessToken: token.accessToken,
          scope: token.scope,
        })
      : await db.shop.upsert({
          where: { domain: shop },
          create: {
            domain: shop,
            name: identity.shop.name,
            shopifyShopId: identity.shop.id,
            encryptedAccessToken: encryptSecret(token.accessToken),
            grantedScopes: token.scope,
            apiVersion: SHOPIFY_API_VERSION,
          },
          update: {
            name: identity.shop.name,
            shopifyShopId: identity.shop.id,
            encryptedAccessToken: encryptSecret(token.accessToken),
            grantedScopes: token.scope,
            apiVersion: SHOPIFY_API_VERSION,
            status: "ACTIVE",
            connectedAt: new Date(),
          },
        });
    const response = NextResponse.redirect(
      new URL(
        `/dashboard?shop=${encodeURIComponent(stored.domain)}`,
        requireShopifyConfig().appUrl,
      ),
    );
    const sid = binding?.accountId || randomUUID();
    await logConnection(stored.id, sid, false);
    response.cookies.set("stockify_session", sessionToken(stored.id, sid), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    response.cookies.delete("stockify_oauth_account");
    response.cookies.delete("stockify_oauth_state");
    response.cookies.delete("stockify_oauth_shop");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL(
        saasEnabled() ? "/account?error=oauth_failed" : "/?error=oauth_failed",
        requireShopifyConfig().appUrl,
      ),
    );
  }
}
