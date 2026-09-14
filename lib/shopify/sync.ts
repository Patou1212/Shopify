import type { Shop } from "@prisma/client";
import { db } from "@/lib/db";
import { shopifyGraphql } from "./graphql";
import { collect, Connection, optionValue, quantities } from "./pagination";
import { withShopLock } from "./lock";
type RemoteLocation = { id: string; name: string; isActive: boolean };
type RemoteVariant = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  selectedOptions: { name: string; value: string }[];
  inventoryItem: { id: string; tracked: boolean };
  product: { id: string; title: string; productType: string; status: string };
};
export type RemoteLevel = {
  location: { id: string };
  quantities: { name: string; quantity: number }[];
};
const pageInfo = "pageInfo { hasNextPage endCursor }";
export async function readLevels(
  shop: Shop,
  item: string,
  heartbeat: () => Promise<void> = async () => {},
) {
  return collect<RemoteLevel>(async (after) => {
    await heartbeat();
    const data = await shopifyGraphql<{
      inventoryItem: { inventoryLevels: Connection<RemoteLevel> } | null;
    }>(
      shop,
      `query($id: ID!, $after: String) { inventoryItem(id: $id) { inventoryLevels(first: 100, after: $after) { nodes { location { id } quantities(names: ["available", "on_hand"]) { name quantity } } ${pageInfo} } } }`,
      { id: item, after },
    );
    if (!data.inventoryItem) throw new Error("Article Shopify introuvable");
    return data.inventoryItem.inventoryLevels;
  });
}
export async function synchronize(shop: Shop) {
  return withShopLock(shop.id, async (heartbeat, token) => {
    const locations = await collect<RemoteLocation>(async (after) => {
      await heartbeat();
      return (
        await shopifyGraphql<{ locations: Connection<RemoteLocation> }>(
          shop,
          `query($after: String) { locations(first: 100, after: $after, includeInactive: true) { nodes { id name isActive } ${pageInfo} } }`,
          { after },
        )
      ).locations;
    });
    const variants = await collect<RemoteVariant>(async (after) => {
      await heartbeat();
      return (
        await shopifyGraphql<{ productVariants: Connection<RemoteVariant> }>(
          shop,
          `query($after: String) { productVariants(first: 100, after: $after) { nodes { id title sku barcode selectedOptions { name value } inventoryItem { id tracked } product { id title productType status } } ${pageInfo} } }`,
          { after },
        )
      ).productVariants;
    });
    const stocks = new Map<string, RemoteLevel[]>();
    for (const v of variants) {
      await heartbeat();
      stocks.set(
        v.id,
        v.inventoryItem.tracked
          ? await readLevels(shop, v.inventoryItem.id, heartbeat)
          : [],
      );
    }
    await heartbeat();
    // Publish only after every remote page succeeds; readers never see a partial snapshot.
    await db.$transaction(
      async (tx) => {
        const owned = await tx.shop.updateMany({
          where: {
            id: shop.id,
            operationToken: token,
            operationExpiresAt: { gt: new Date() },
          },
          data: { lastSyncedAt: new Date() },
        });
        if (!owned.count) throw new Error("Synchronisation expirée");
        await tx.location.updateMany({
          where: { shopId: shop.id },
          data: { active: false },
        });
        await tx.variant.updateMany({
          where: { shopId: shop.id },
          data: { active: false },
        });
        const locationIds = new Map<string, string>();
        for (const l of locations) {
          const saved = await tx.location.upsert({
            where: {
              shopId_shopifyLocationId: {
                shopId: shop.id,
                shopifyLocationId: l.id,
              },
            },
            create: {
              shopId: shop.id,
              shopifyLocationId: l.id,
              name: l.name,
              active: l.isActive,
            },
            update: { name: l.name, active: l.isActive },
          });
          locationIds.set(l.id, saved.id);
        }
        await tx.inventoryLevel.deleteMany({ where: { shopId: shop.id } });
        for (const v of variants) {
          const product = await tx.product.upsert({
            where: {
              shopId_shopifyProductId: {
                shopId: shop.id,
                shopifyProductId: v.product.id,
              },
            },
            create: {
              shopId: shop.id,
              shopifyProductId: v.product.id,
              title: v.product.title,
              productType: v.product.productType,
            },
            update: {
              title: v.product.title,
              productType: v.product.productType,
            },
          });
          const data = {
            productId: product.id,
            title: v.title,
            sku: v.sku,
            barcode: v.barcode,
            shopifyInventoryItemId: v.inventoryItem.id,
            optionSize: optionValue(v.selectedOptions, [
              "size",
              "taille",
              "pointure",
            ]),
            optionColor: optionValue(v.selectedOptions, [
              "color",
              "colour",
              "couleur",
            ]),
            active: v.product.status !== "ARCHIVED" && v.inventoryItem.tracked,
          };
          const variant = await tx.variant.upsert({
            where: {
              shopId_shopifyVariantId: {
                shopId: shop.id,
                shopifyVariantId: v.id,
              },
            },
            create: { ...data, shopId: shop.id, shopifyVariantId: v.id },
            update: data,
          });
          for (const level of stocks.get(v.id) ?? []) {
            const locationId = locationIds.get(level.location.id);
            if (!locationId)
              throw new Error("Emplacement absent de la synchronisation");
            await tx.inventoryLevel.create({
              data: {
                shopId: shop.id,
                variantId: variant.id,
                locationId,
                ...quantities(level.quantities),
              },
            });
          }
        }
      },
      { timeout: 120000 },
    );
    return { locations: locations.length, variants: variants.length };
  });
}
