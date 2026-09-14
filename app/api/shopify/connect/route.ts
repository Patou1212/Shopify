import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/shopify/oauth";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/domain";

export async function GET(request: NextRequest) {
  const shop = normalizeShopDomain(request.nextUrl.searchParams.get("shop") ?? "");
  if (!isValidShopDomain(shop)) return NextResponse.redirect(new URL("/?error=invalid_shop", request.url));
  const state = createOAuthState();
  const response = NextResponse.redirect(buildAuthorizeUrl(shop, state));
  response.cookies.set("stockify_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 900, path: "/" });
  response.cookies.set("stockify_oauth_shop", shop, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 900, path: "/" });
  return response;
}
