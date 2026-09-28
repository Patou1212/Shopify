import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/shopify/connect/route";
afterEach(() => vi.unstubAllEnvs());
test("redirects invalid shop to public origin even when proxy request uses localhost", async () => {
  vi.stubEnv("APP_URL", "https://stockify.example.com");
  vi.stubEnv("SHOPIFY_CLIENT_ID", "test-client");
  vi.stubEnv("SHOPIFY_CLIENT_SECRET", "test-secret");
  const response = await GET(
    new NextRequest("http://localhost:3000/api/shopify/connect?shop=invalid"),
  );
  expect(response.headers.get("location")).toBe(
    "https://stockify.example.com/?error=invalid_shop",
  );
});
