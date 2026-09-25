import type { Shop } from "@prisma/client";
import { db } from "@/lib/db";
export const DEMO_SHOP_ID = "stockify-local-demo";
export function demoEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.STOCKIFY_DEMO === "true"
  );
}
export async function adjustDemo(
  shop: Shop,
  variantId: string,
  locationId: string,
  delta: number,
  reason: string,
  key: string,
  actorSessionId?: string,
) {
  if (!demoEnabled() || shop.id !== DEMO_SHOP_ID)
    throw new Error("Démonstration indisponible");
  if (
    !Number.isInteger(delta) ||
    !delta ||
    Math.abs(delta) > 1000000 ||
    !reason.trim() ||
    reason.length > 500 ||
    !/^[a-f0-9-]{36}$/.test(key)
  )
    throw new Error("Ajustement invalide");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(879641)`;
    const previous = await tx.inventoryAdjustment.findUnique({
      where: { idempotencyKey: key },
    });
    if (previous) {
      if (
        previous.shopId !== shop.id ||
        previous.variantId !== variantId ||
        previous.locationId !== locationId ||
        previous.delta !== delta ||
        previous.customReason !== reason
      )
        throw new Error("Clé déjà utilisée");
      return previous;
    }
    const level = await tx.inventoryLevel.findFirst({
      where: {
        shopId: shop.id,
        variantId,
        locationId,
        variant: { active: true },
        location: { active: true, excluded: false },
      },
    });
    if (!level) throw new Error("Stock de démonstration introuvable");
    await tx.inventoryLevel.update({
      where: { id: level.id },
      data: {
        availableQty: { increment: delta },
        onHandQty: { increment: delta },
        syncedAt: new Date(),
      },
    });
    return tx.inventoryAdjustment.create({
      data: {
        shopId: shop.id,
        variantId,
        locationId,
        delta,
        beforeQuantity: level.availableQty,
        afterQuantity: level.availableQty + delta,
        reason: "correction",
        customReason: reason,
        idempotencyKey: key,
        actorSessionId,
        status: "APPLIED",
      },
    });
  });
}
