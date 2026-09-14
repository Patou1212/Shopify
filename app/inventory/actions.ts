"use server";
import { db } from "@/lib/db";
import { requireShop } from "@/lib/session";
import { synchronize } from "@/lib/shopify/sync";
import { adjust } from "@/lib/shopify/adjust";
import { revalidatePath } from "next/cache";
export async function syncAction() {
  const shop = await requireShop();
  try {
    const result = await synchronize(shop);
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return {
      message: `${result.variants} variantes et ${result.locations} emplacements synchronisés.`,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Synchronisation échouée",
    };
  }
}
export async function adjustAction(
  variantId: string,
  locationId: string,
  delta: number,
  reason: string,
  key: string,
) {
  const shop = await requireShop();
  try {
    const result = await adjust(
      shop,
      variantId,
      locationId,
      delta,
      reason,
      key,
    );
    revalidatePath("/inventory");
    revalidatePath("/history");
    revalidatePath("/dashboard");
    return {
      message:
        "warning" in result ? String(result.warning) : "Ajustement enregistré.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ajustement échoué" };
  }
}

export async function retryAction(id: string) {
  const shop = await requireShop();
  const record = await db.inventoryAdjustment.findFirst({
    where: { id, shopId: shop.id },
  });
  if (!record) return { error: "Demande introuvable" };
  return adjustAction(
    record.variantId,
    record.locationId,
    record.delta,
    record.customReason || record.reason,
    record.idempotencyKey,
  );
}
