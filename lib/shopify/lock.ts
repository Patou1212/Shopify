import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
export async function withShopLock<T>(
  shopId: string,
  run: (heartbeat: () => Promise<void>, token: string) => Promise<T>,
) {
  const token = randomUUID();
  const acquired = await db.shop.updateMany({
    where: {
      id: shopId,
      OR: [
        { operationToken: null },
        { operationExpiresAt: { lt: new Date() } },
      ],
    },
    data: {
      operationToken: token,
      operationExpiresAt: new Date(Date.now() + 120000),
    },
  });
  if (!acquired.count)
    throw new Error("Une opération est déjà en cours pour cette boutique.");
  const heartbeat = async () => {
    const result = await db.shop.updateMany({
      where: { id: shopId, operationToken: token },
      data: { operationExpiresAt: new Date(Date.now() + 120000) },
    });
    if (!result.count)
      throw new Error("Verrou expiré : relancez la synchronisation.");
  };
  try {
    return await run(heartbeat, token);
  } finally {
    await db.shop.updateMany({
      where: { id: shopId, operationToken: token },
      data: { operationToken: null, operationExpiresAt: null },
    });
  }
}
