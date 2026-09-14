import type { Shop } from "@prisma/client";
import { db } from "@/lib/db";
import { shopifyGraphql } from "./graphql";
import { readLevels } from "./sync";
import { quantities } from "./pagination";
import { withShopLock } from "./lock";
export async function adjust(
  shop: Shop,
  variantId: string,
  locationId: string,
  delta: number,
  reason: string,
  key: string,
) {
  if (
    !Number.isInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 1000000 ||
    !reason.trim() ||
    reason.length > 500 ||
    !/^[a-f0-9-]{36}$/.test(key)
  )
    throw new Error("Ajustement invalide");
  return withShopLock(shop.id, async (heartbeat) => {
    const level = await db.inventoryLevel.findFirst({
      where: {
        shopId: shop.id,
        variantId,
        locationId,
        variant: { active: true },
        location: { active: true, excluded: false },
      },
      include: { variant: true, location: true },
    });
    if (!level) throw new Error("Stock introuvable");
    let record = await db.inventoryAdjustment.findUnique({
      where: { idempotencyKey: key },
    });
    if (
      record &&
      (record.shopId !== shop.id ||
        record.variantId !== variantId ||
        record.locationId !== locationId ||
        record.delta !== delta ||
        record.customReason !== reason)
    )
      throw new Error("Clé déjà utilisée pour un autre ajustement");
    if (record?.status === "APPLIED") return record;
    if (record?.status === "FAILED")
      throw new Error(record.error || "Ajustement refusé");
    if (record && Date.now() - record.createdAt.getTime() > 3600000)
      throw new Error(
        "Résultat incertain : vérifier dans Shopify avant toute nouvelle opération.",
      );
    if (
      !record &&
      (await db.inventoryAdjustment.findFirst({
        where: { shopId: shop.id, variantId, locationId, status: "PENDING" },
      }))
    )
      throw new Error(
        "Une demande reste à vérifier pour ce stock. Reprenez-la depuis l'historique.",
      );
    await heartbeat();
    record ??= await db.inventoryAdjustment.create({
      data: {
        shopId: shop.id,
        variantId,
        locationId,
        delta,
        reason: "correction",
        customReason: reason,
        idempotencyKey: key,
        beforeQuantity: level.availableQty,
        afterQuantity: level.availableQty + delta,
      },
    });
    const result = await shopifyGraphql<{
      inventoryAdjustQuantities: {
        userErrors: { message: string }[];
        inventoryAdjustmentGroup: {
          changes: {
            name: string;
            delta: number;
            quantityAfterChange: number | null;
          }[];
        } | null;
      };
    }>(
      shop,
      `mutation($input: InventoryAdjustQuantitiesInput!, $key: String!) { inventoryAdjustQuantities(input: $input) @idempotent(key: $key) { userErrors { message } inventoryAdjustmentGroup { changes { name delta quantityAfterChange } } } }`,
      {
        key,
        input: {
          name: "available",
          reason: "correction",
          referenceDocumentUri: `stockify://adjustments/${record.id}`,
          changes: [
            {
              inventoryItemId: level.variant.shopifyInventoryItemId,
              locationId: level.location.shopifyLocationId,
              changeFromQuantity: record.beforeQuantity,
              delta,
            },
          ],
        },
      },
    );
    const payload = result.inventoryAdjustQuantities;
    if (payload.userErrors.length) {
      const error = payload.userErrors.map((e) => e.message).join(" · ");
      await db.inventoryAdjustment.update({
        where: { id: record.id },
        data: { status: "FAILED", error },
      });
      throw new Error(error);
    }
    const change = payload.inventoryAdjustmentGroup?.changes.find(
      (c) => c.name === "available",
    );
    if (change?.quantityAfterChange == null)
      throw new Error("Résultat incertain : réessayez avec la même demande.");
    const updated = await db.inventoryAdjustment.update({
      where: { id: record.id },
      data: {
        status: "APPLIED",
        beforeQuantity: change.quantityAfterChange - change.delta,
        afterQuantity: change.quantityAfterChange,
      },
    });
    // Do not manufacture on_hand from the local snapshot: fetch both authoritative quantities.
    try {
      const fresh = (
        await readLevels(shop, level.variant.shopifyInventoryItemId, heartbeat)
      ).find((l) => l.location.id === level.location.shopifyLocationId);
      if (!fresh) throw new Error("Niveau absent");
      await db.inventoryLevel.update({
        where: { id: level.id },
        data: { ...quantities(fresh.quantities), syncedAt: new Date() },
      });
    } catch {
      return {
        ...updated,
        warning:
          "Ajustement appliqué. Synchronisez pour actualiser les quantités affichées.",
      };
    }
    return updated;
  });
}
