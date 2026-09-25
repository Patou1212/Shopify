import { Portal } from "@/app/components/portal";
import { requireShop } from "@/lib/session";
import { db } from "@/lib/db";
import StockStudio from "./studio";

export default async function Dashboard() {
  const shop = await requireShop();
  const levels = await db.inventoryLevel.findMany({
    where: {
      shopId: shop.id,
      variant: { active: true },
      location: { active: true, excluded: false },
    },
    include: { location: true, variant: { include: { product: true } } },
    orderBy: [{ variant: { product: { title: "asc" } } }, { id: "asc" }],
  });
  const rows = levels.map((l) => ({
    id: l.id,
    productId: l.variant.productId,
    variantId: l.variantId,
    product: l.variant.product.title,
    family:
      l.variant.product.family ||
      l.variant.product.productType ||
      "Sans famille",
    variant: l.variant.title,
    sku: l.variant.sku || "",
    barcode: l.variant.barcode || "",
    size: l.variant.optionSize || "Non renseignée",
    color: l.variant.optionColor || "Non renseignée",
    location: l.location.name,
    locationId: l.locationId,
    available: l.availableQty,
    physical: l.onHandQty,
    synced: l.syncedAt.toISOString(),
  }));
  return (
    <Portal active="dashboard" shop={shop}>
      <StockStudio
        rows={rows}
        synced={shop.lastSyncedAt?.toISOString() || null}
      />
    </Portal>
  );
}
