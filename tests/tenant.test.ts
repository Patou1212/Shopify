import { expect, test, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
import { canAccessShop, assertLinkAllowed, linkShop } from "@/lib/tenant";
const member = {
  workspaceId: "a",
  role: "VIEWER",
  workspace: { suspended: false },
};
test("rejects missing membership, orphan shops and cross-tenant access", () => {
  expect(canAccessShop(null, "a")).toBe(false);
  expect(canAccessShop(member, null)).toBe(false);
  expect(canAccessShop(member, "b")).toBe(false);
  expect(canAccessShop(member, "a")).toBe(true);
});
test("viewers cannot mutate stock; suspended workspaces cannot read", () => {
  expect(canAccessShop(member, "a", true)).toBe(false);
  expect(canAccessShop({ ...member, role: "MANAGER" }, "a", true)).toBe(true);
  expect(
    canAccessShop({ ...member, workspace: { suspended: true } }, "a"),
  ).toBe(false);
});
test("counts new shops against quota but allows reconnecting own shop", () => {
  const workspace = { suspended: false, shopLimit: 1 };
  expect(() => assertLinkAllowed(workspace, 1, undefined, "a")).toThrow(
    "Quota",
  );
  expect(() => assertLinkAllowed(workspace, 1, "a", "a")).not.toThrow();
  expect(() => assertLinkAllowed(workspace, 0, "b", "a")).toThrow();
  expect(() => assertLinkAllowed(workspace, 0, null, "a")).toThrow();
});
test("does not save credentials for a Shopify alias owned by another client", async () => {
  const tx = {
    $executeRaw: vi.fn(),
    workspace: {
      update: vi
        .fn()
        .mockResolvedValue({ id: "a", suspended: false, shopLimit: 3 }),
    },
    membership: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ role: "OWNER", account: { disabled: false } }),
    },
    shop: {
      findMany: vi.fn().mockResolvedValue([{ id: "shop", workspaceId: "b" }]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  mocks.transaction.mockImplementation((fn) => fn(tx));
  await expect(
    linkShop({
      workspaceId: "a",
      accountId: "user",
      domain: "alias.myshopify.com",
      shopifyId: "gid://shopify/Shop/123",
      name: "Store",
      accessToken: "never-save",
      scope: "read_products",
    }),
  ).rejects.toThrow();
  expect(tx.shop.update).not.toHaveBeenCalled();
  expect(tx.shop.create).not.toHaveBeenCalled();
  expect(tx.$executeRaw).toHaveBeenCalled();
});
