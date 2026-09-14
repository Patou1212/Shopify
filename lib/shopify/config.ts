export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
export const SHOPIFY_SCOPES = (process.env.SHOPIFY_SCOPES || "read_products,read_inventory,write_inventory,read_locations").split(",").map((v) => v.trim()).filter(Boolean);

export function requireShopifyConfig() {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!clientId || !clientSecret || !appUrl) throw new Error("Shopify configuration is incomplete");
  return { clientId, clientSecret, appUrl };
}
