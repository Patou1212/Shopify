import type { Shop } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
export async function shopifyGraphql<T>(
  shop: Shop,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  if (shop.id === "stockify-local-demo") throw new Error("La boutique fictive ne peut pas contacter Shopify");
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(
      `https://${shop.domain}/admin/api/${shop.apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": decryptSecret(shop.encryptedAccessToken),
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (response.status === 429) {
      await new Promise((r) =>
        setTimeout(r, Math.min(10000, 1000 * 2 ** attempt)),
      );
      continue;
    }
    if (!response.ok) throw new Error(`Shopify HTTP ${response.status}`);
    const json = await response.json();
    if (
      json.errors?.every(
        (e: { extensions?: { code?: string } }) =>
          e.extensions?.code === "THROTTLED",
      )
    ) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (json.errors?.length)
      throw new Error(
        json.errors.map((e: { message: string }) => e.message).join(" | "),
      );
    if (!json.data) throw new Error("Réponse Shopify vide");
    return json.data as T;
  }
  throw new Error("Shopify occupé. Réessayez plus tard.");
}
