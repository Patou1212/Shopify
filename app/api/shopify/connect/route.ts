import { saasEnabled, accountSession } from "@/lib/account";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertLinkAllowed } from "@/lib/tenant";
import { ShopLinkError } from "@/lib/onboarding";
import { requireShopifyConfig } from "@/lib/shopify/config";
import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/shopify/oauth";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/domain";
export async function GET(request: NextRequest) {
  const saas = saasEnabled();
  const base = process.env.APP_URL || request.nextUrl.origin;
  const fail = (error: string) =>
    NextResponse.redirect(
      new URL(`${saas ? "/account" : "/"}?error=${error}`, base),
    );
  const shop = normalizeShopDomain(
    request.nextUrl.searchParams.get("shop") || "",
  );
  if (!isValidShopDomain(shop)) return fail("invalid_shop");
  const state = createOAuthState();
  let binding: string | undefined;
  if (saas) {
    const session = await accountSession();
    if (!session) return NextResponse.redirect(new URL("/account/login", base));
    const workspaceId = request.nextUrl.searchParams.get("workspace") || "";
    const member = await db.membership.findUnique({
      where: {
        accountId_workspaceId: { accountId: session.accountId, workspaceId },
      },
      include: { workspace: true },
    });
    if (member?.role !== "OWNER" || member.workspace.suspended)
      return fail("workspace_unavailable");
    const existing = await db.shop.findUnique({ where: { domain: shop } });
    const count = await db.shop.count({ where: { workspaceId } });
    try {
      assertLinkAllowed(
        member.workspace,
        count,
        existing?.workspaceId,
        workspaceId,
      );
    } catch (e) {
      return fail(e instanceof ShopLinkError ? e.code : "oauth_failed");
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
  let authorize: string;
  try {
    requireShopifyConfig();
    authorize = buildAuthorizeUrl(shop, state);
  } catch {
    return fail("configuration");
  }
  const response = NextResponse.redirect(authorize);
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 900,
    path: "/",
  };
  response.cookies.set("stockify_oauth_state", state, options);
  response.cookies.set("stockify_oauth_shop", shop, options);
  if (binding) response.cookies.set("stockify_oauth_account", binding, options);
  return response;
}
