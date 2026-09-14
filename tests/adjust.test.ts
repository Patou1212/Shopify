import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  pending: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  level: vi.fn(),
  levelUpdate: vi.fn(),
  graphql: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    inventoryLevel: { findFirst: mocks.level, update: mocks.levelUpdate },
    inventoryAdjustment: {
      findUnique: mocks.find,
      findFirst: mocks.pending,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));
vi.mock("../lib/shopify/lock", () => ({
  withShopLock: async (
    _: string,
    fn: (heartbeat: () => Promise<void>) => unknown,
  ) => fn(async () => {}),
}));
vi.mock("../lib/shopify/graphql", () => ({ shopifyGraphql: mocks.graphql }));
vi.mock("../lib/shopify/sync", () => ({ readLevels: mocks.read }));
import { adjust } from "../lib/shopify/adjust";
import type { Shop } from "@prisma/client";
const shop = { id: "shop" } as Shop;
const key = "12345678-1234-1234-1234-123456789abc";
const record = {
  id: "adjustment",
  shopId: "shop",
  variantId: "variant",
  locationId: "location",
  delta: 2,
  customReason: "Comptage",
  beforeQuantity: 5,
  createdAt: new Date(),
  status: "PENDING",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.level.mockResolvedValue({
    id: "level",
    availableQty: 5,
    variant: { shopifyInventoryItemId: "item" },
    location: { shopifyLocationId: "remote" },
  });
  mocks.create.mockResolvedValue(record);
  mocks.update.mockImplementation(async ({ data }) => ({ ...record, ...data }));
  mocks.read.mockResolvedValue([
    {
      location: { id: "remote" },
      quantities: [
        { name: "available", quantity: 7 },
        { name: "on_hand", quantity: 10 },
      ],
    },
  ]);
  mocks.graphql.mockResolvedValue({
    inventoryAdjustQuantities: {
      userErrors: [],
      inventoryAdjustmentGroup: {
        changes: [{ name: "available", delta: 2, quantityAfterChange: 7 }],
      },
    },
  });
});
test("sends CAS and idempotency key and records authoritative quantities", async () => {
  await adjust(shop, "variant", "location", 2, "Comptage", key);
  expect(mocks.graphql.mock.calls[0][2]).toMatchObject({
    key,
    input: { changes: [{ delta: 2, changeFromQuantity: 5 }] },
  });
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: "adjustment" },
    data: { status: "APPLIED", beforeQuantity: 5, afterQuantity: 7 },
  });
  expect(mocks.levelUpdate.mock.calls[0][0].data.onHandQty).toBe(10);
});
test("applied retry never calls Shopify twice", async () => {
  mocks.find.mockResolvedValue({ ...record, status: "APPLIED" });
  await adjust(shop, "variant", "location", 2, "Comptage", key);
  expect(mocks.graphql).not.toHaveBeenCalled();
});
test("rejects a cross-shop idempotency collision", async () => {
  mocks.find.mockResolvedValue({ ...record, shopId: "other" });
  await expect(
    adjust(shop, "variant", "location", 2, "Comptage", key),
  ).rejects.toThrow("autre ajustement");
  expect(mocks.graphql).not.toHaveBeenCalled();
});
test("stale stock error never updates local quantities", async () => {
  mocks.graphql.mockResolvedValue({
    inventoryAdjustQuantities: {
      userErrors: [{ message: "CHANGE_FROM_QUANTITY_STALE" }],
      inventoryAdjustmentGroup: null,
    },
  });
  await expect(
    adjust(shop, "variant", "location", 2, "Comptage", key),
  ).rejects.toThrow("STALE");
  expect(mocks.levelUpdate).not.toHaveBeenCalled();
});
test("network ambiguity stays pending for the same-key retry", async () => {
  mocks.graphql.mockRejectedValue(new Error("timeout"));
  await expect(
    adjust(shop, "variant", "location", 2, "Comptage", key),
  ).rejects.toThrow("timeout");
  expect(mocks.update).not.toHaveBeenCalled();
});

test("blocks a new key while an earlier request for this stock is uncertain", async () => {
  mocks.pending.mockResolvedValue(record);
  await expect(
    adjust(shop, "variant", "location", 2, "Comptage", key),
  ).rejects.toThrow("historique");
  expect(mocks.graphql).not.toHaveBeenCalled();
});
