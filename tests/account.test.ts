import { expect, test, vi, afterEach } from "vitest";
const mock = vi.hoisted(() => ({ find: vi.fn(), cookie: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { accountSession: { findUnique: mock.find } },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mock.cookie }),
}));
import {
  hashPassword,
  verifyPassword,
  digest,
  accountSession,
} from "@/lib/account";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test("password hashes use independent salts and reject incorrect passwords", () => {
  const first = hashPassword("Example-password-2026");
  expect(first).not.toEqual(hashPassword("Example-password-2026"));
  expect(verifyPassword("Example-password-2026", first)).toBe(true);
  expect(verifyPassword("Wrong-password-2026", first)).toBe(false);
  expect(() => hashPassword("short")).toThrow();
  expect(verifyPassword("x".repeat(257), first)).toBe(false);
});
test("disabled accounts and expired sessions are rejected", async () => {
  vi.stubEnv("STOCKIFY_SAAS", "true");
  mock.cookie.mockReturnValue({ value: "opaque-token" });
  mock.find.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60000),
    account: { disabled: true },
  });
  expect(await accountSession()).toBeNull();
  mock.find.mockResolvedValue({
    expiresAt: new Date(0),
    account: { disabled: false },
  });
  expect(await accountSession()).toBeNull();
  expect(mock.find).toHaveBeenCalledWith({
    where: { tokenHash: digest("opaque-token") },
    include: { account: true },
  });
});
test("legacy mode never treats a cookie as a SaaS session", async () => {
  vi.stubEnv("STOCKIFY_SAAS", "false");
  expect(await accountSession()).toBeNull();
  expect(mock.find).not.toHaveBeenCalled();
});
