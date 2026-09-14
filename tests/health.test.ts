import { expect, test, vi } from "vitest";
const count = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { shop: { count } } }));
import { GET } from "@/app/api/health/route";
test("health checks the migrated schema", async () => {
  count.mockResolvedValue(0);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
test("health never exposes database errors or credentials", async () => {
  count.mockRejectedValue(new Error("postgresql://user:secret@host"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});
