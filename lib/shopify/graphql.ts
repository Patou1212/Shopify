import type { Shop } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";

export async function shopifyGraphql<T = any>(shop: Shop, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://${shop.domain}/admin/api/${shop.apiVersion}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": decryptSecret(shop.encryptedAccessToken) },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}`);
  if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join(" | "));
  return json.data as T;
}
