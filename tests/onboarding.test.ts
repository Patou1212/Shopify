import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/shopify/connect/route";
import {
  connectionError,
  defaultShopLimit,
  ShopLinkError,
} from "@/lib/onboarding";
import { assertLinkAllowed } from "@/lib/tenant";
afterEach(() => vi.unstubAllEnvs());
test("invalid Shopify domain returns to client account with a visible explanation", async () => {
  vi.stubEnv("STOCKIFY_SAAS", "true");
  vi.stubEnv("APP_URL", "https://stockify.example.com");
  const response = await GET(
    new NextRequest(
      "http://localhost:3000/api/shopify/connect?shop=rosyneclub.com",
    ),
  );
  expect(response.headers.get("location")).toBe(
    "https://stockify.example.com/account?error=invalid_shop",
  );
  expect(connectionError("invalid_shop")).toContain("myshopify.com");
});
test("quota and ownership failures retain distinct actionable codes", () => {
  const w = { shopLimit: 1, suspended: false };
  for (const [count, existing, code] of [
    [0, null, "shop_unassigned"],
    [0, "other", "shop_owned"],
    [1, undefined, "shop_limit"],
  ] as const) {
    try {
      assertLinkAllowed(w, count, existing, "mine");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShopLinkError);
      expect((e as ShopLinkError).code).toBe(code);
      expect(connectionError(code)).toBeTruthy();
    }
  }
});
test("default limit is bounded and unknown errors never reflect arbitrary text", () => {
  vi.stubEnv("STOCKIFY_FREE_SHOP_LIMIT", "-1");
  expect(defaultShopLimit()).toBe(1);
  vi.stubEnv("STOCKIFY_FREE_SHOP_LIMIT", "3");
  expect(defaultShopLimit()).toBe(3);
  expect(connectionError("secret-debug-output")).not.toContain(
    "secret-debug-output",
  );
});
