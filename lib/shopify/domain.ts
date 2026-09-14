export function normalizeShopDomain(input: string) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}
export function isValidShopDomain(shop: string) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}
