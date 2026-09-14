import crypto from "node:crypto";
import { SHOPIFY_SCOPES, requireShopifyConfig } from "./config";
import { isValidShopDomain, normalizeShopDomain } from "./domain";

export const createOAuthState = () => crypto.randomBytes(24).toString("hex");

export function buildAuthorizeUrl(shopInput: string, state: string) {
  const shop = normalizeShopDomain(shopInput);
  if (!isValidShopDomain(shop)) throw new Error("Invalid Shopify shop domain");
  const { clientId, appUrl } = requireShopifyConfig();
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SHOPIFY_SCOPES.join(","));
  url.searchParams.set("redirect_uri", `${appUrl}/api/shopify/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function verifyOAuthHmac(params: URLSearchParams) {
  const { clientSecret } = requireShopifyConfig();
  const provided = params.get("hmac");
  if (!provided) return false;
  const message = [...params.entries()].filter(([k]) => k !== "hmac" && k !== "signature").sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("&");
  const expected = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
  const a = Buffer.from(provided); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}

export async function exchangeCodeForToken(shopInput: string, code: string) {
  const shop = normalizeShopDomain(shopInput);
  const { clientId, clientSecret } = requireShopifyConfig();
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }), cache: "no-store" });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "Shopify OAuth failed");
  return { accessToken: String(body.access_token), scope: String(body.scope || "") };
}
