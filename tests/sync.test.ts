import { expect, test, vi, beforeEach } from "vitest";
import type { Shop } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  graphql: vi.fn(),
  transaction: vi.fn(),
  locationUpsert: vi.fn(),
  variantUpsert: vi.fn(),
  productUpsert: vi.fn(),
  createLevel: vi.fn(),
  deleteLevels: vi.fn(),
  locationDeactivate: vi.fn(),
  variantDeactivate: vi.fn(),
  shopUpdate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("../lib/shopify/graphql", () => ({ shopifyGraphql: mocks.graphql }));
vi.mock("../lib/shopify/lock", () => ({
  withShopLock: async (
    _: string,
    run: (h: () => Promise<void>, token: string) => unknown,
  ) => run(async () => {}, "lock"),
}));
import { synchronize } from "../lib/shopify/sync";
const connection = (nodes: unknown[]) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});
const variant = {
  id: "v",
  title: "Bleu M",
  sku: "SKU",
  barcode: null,
  selectedOptions: [
    { name: "Couleur", value: "Bleu" },
    { name: "Taille", value: "M" },
  ],
  inventoryItem: { id: "item", tracked: true },
  product: {
    id: "p",
    title: "T-shirt",
    productType: "Hauts",
    status: "ACTIVE",
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.shopUpdate.mockResolvedValue({ count: 1 });
  mocks.locationUpsert.mockResolvedValue({ id: "local-location" });
  mocks.productUpsert.mockResolvedValue({ id: "local-product" });
  mocks.variantUpsert.mockResolvedValue({ id: "local-variant" });
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      shop: { updateMany: mocks.shopUpdate },
      location: {
        updateMany: mocks.locationDeactivate,
        upsert: mocks.locationUpsert,
      },
      variant: {
        updateMany: mocks.variantDeactivate,
        upsert: mocks.variantUpsert,
      },
      product: { upsert: mocks.productUpsert },
      inventoryLevel: {
        deleteMany: mocks.deleteLevels,
        create: mocks.createLevel,
      },
    }),
  );
  mocks.graphql.mockImplementation(async (_shop, query) => {
    if (query.includes("locations(first"))
      return {
        locations: connection([{ id: "l", name: "Paris", isActive: true }]),
      };
    if (query.includes("productVariants(first"))
      return { productVariants: connection([variant]) };
    return {
      inventoryItem: {
        inventoryLevels: connection([
          {
            location: { id: "l" },
            quantities: [
              { name: "available", quantity: 3 },
              { name: "on_hand", quantity: 8 },
            ],
          },
        ]),
      },
    };
  });
});
test("publishes a complete snapshot scoped to the shop, preserving real quantities", async () => {
  await synchronize({ id: "shop" } as Shop);
  expect(mocks.deleteLevels).toHaveBeenCalledWith({
    where: { shopId: "shop" },
  });
  expect(mocks.variantDeactivate).toHaveBeenCalledWith({
    where: { shopId: "shop" },
    data: { active: false },
  });
  expect(mocks.createLevel).toHaveBeenCalledWith({
    data: {
      shopId: "shop",
      variantId: "local-variant",
      locationId: "local-location",
      availableQty: 3,
      onHandQty: 8,
    },
  });
  expect(mocks.shopUpdate.mock.calls[0][0].where.operationToken).toBe("lock");
});
test("a late remote failure leaves the entire previous snapshot untouched", async () => {
  mocks.graphql.mockImplementation(async (_shop, query) => {
    if (query.includes("locations(first")) return { locations: connection([]) };
    if (query.includes("productVariants(first"))
      return { productVariants: connection([variant]) };
    throw new Error("Remote timeout");
  });
  await expect(synchronize({ id: "shop" } as Shop)).rejects.toThrow(
    "Remote timeout",
  );
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.deleteLevels).not.toHaveBeenCalled();
});
