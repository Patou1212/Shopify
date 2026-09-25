import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { Snapshot } from "./audit-diff";
export async function inventorySnapshot(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<Snapshot[]> {
  const variants = await tx.variant.findMany({
    where: { shopId, active: true },
    include: {
      product: true,
      inventoryLevels: { include: { location: true } },
    },
  });
  const products = new Map<string, Snapshot>();
  const result: Snapshot[] = [];
  for (const v of variants) {
    products.set(v.productId, {
      key: `product:${v.productId}`,
      category: "products",
      subject: v.product.title,
      value: JSON.stringify({
        nom: v.product.title,
        type: v.product.productType,
        famille: v.product.family,
      }),
    });
    result.push({
      key: `variant:${v.id}`,
      category: "products",
      subject: `${v.product.title} · ${v.title}`,
      value: JSON.stringify({
        variante: v.title,
        sku: v.sku,
        codeBarres: v.barcode,
        taille: v.optionSize,
        couleur: v.optionColor,
      }),
    });
    for (const l of v.inventoryLevels)
      result.push({
        key: `stock:${v.id}:${l.locationId}`,
        category: "stock",
        subject: `${v.product.title} · ${v.title} · ${l.location.name}`,
        value: `Disponible : ${l.availableQty}, physique : ${l.onHandQty}`,
      });
  }
  return [...products.values(), ...result];
}
export async function logConnection(
  shopId: string,
  sessionId: string,
  demo: boolean,
) {
  await db.auditEvent.create({
    data: {
      shopId,
      category: "connections",
      action: demo ? "Ouverture démonstration" : "Connexion boutique réussie",
      subject: demo ? "Session de démonstration" : "Session Shopify",
      source: demo ? "Démonstration" : "Stockify",
      actor: `Session ${sessionId}`,
      details:
        "Identité individuelle non disponible. Cette connexion identifie la boutique, pas un salarié.",
    },
  });
}
