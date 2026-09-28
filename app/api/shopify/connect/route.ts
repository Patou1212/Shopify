import { saasEnabled, requireWorkspace } from "@/lib/account";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertLinkAllowed } from "@/lib/tenant";
import { requireShopifyConfig } from "@/lib/shopify/config";
import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/shopify/oauth";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/domain";

export async function GET(request: NextRequest) {
  const shop = normalizeShopDomain(
    request.nextUrl.searchParams.get("shop") ?? "",
  );
  if (!isValidShopDomain(shop))
    return NextResponse.redirect(
      new URL("/?error=invalid_shop", requireShopifyConfig().appUrl),
    );
  const state = createOAuthState();
  let binding: string | undefined;
  if (saasEnabled()) {
    const workspaceId = request.nextUrl.searchParams.get("workspace") || "";
    const { session, member } = await requireWorkspace(workspaceId, ["OWNER"]);
    const existing = await db.shop.findUnique({ where: { domain: shop } });
    const count = await db.shop.count({ where: { workspaceId } });
    try {
      assertLinkAllowed(
        member.workspace,
        count,
        existing?.workspaceId,
        workspaceId,
      );
    } catch {
      return NextResponse.redirect(
        new URL(
          "/account?error=shop_limit_or_owner",
          requireShopifyConfig().appUrl,
        ),
      );
    }
    binding = encryptSecret(
      JSON.stringify({
        workspaceId,
        sessionId: session.id,
        accountId: session.accountId,
        shop,
        state,
        expires: Date.now() + 900000,
      }),
    );
  }
  const response = NextResponse.redirect(buildAuthorizeUrl(shop, state));
  response.cookies.set("stockify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 900,
    path: "/",
  });
  response.cookies.set("stockify_oauth_shop", shop, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 900,
    path: "/",
  });
  if (binding)
    response.cookies.set("stockify_oauth_account", binding, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
  return response;
}
