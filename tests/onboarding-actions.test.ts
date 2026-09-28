import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  throttle: vi.fn(),
  session: vi.fn(),
  findShop: vi.fn(),
  authorize: vi.fn(),
  sync: vi.fn(),
  createSession: vi.fn(),
}));
vi.mock("@/lib/account", () => ({
  saasEnabled: () => true,
  throttle: mocks.throttle,
  requireAccount: mocks.session,
  requireWorkspace: mocks.authorize,
  createSession: mocks.createSession,
}));
vi.mock("@/lib/registration", () => ({ registerAccount: mocks.register }));
vi.mock("@/lib/db", () => ({ db: { shop: { findUnique: mocks.findShop } } }));
vi.mock("@/lib/shopify/sync", () => ({ synchronize: mocks.sync }));
vi.mock("@/lib/session", () => ({ sessionToken: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logConnection: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { register, importShop } from "@/app/account/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.throttle.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ accountId: "a" });
});
function form() {
  const f = new FormData();
  f.set("name", "Client");
  f.set("email", "client@example.com");
  f.set("password", "long-password-example");
  f.set("confirmPassword", "long-password-example");
  return f;
}
test("mismatched passwords do not create an account", async () => {
  const f = form();
  f.set("confirmPassword", "different-password");
  expect((await register({}, f)).error).toContain("correspondent");
  expect(mocks.register).not.toHaveBeenCalled();
});
test("registration rate limit prevents expensive account creation", async () => {
  mocks.throttle.mockResolvedValue(false);
  expect((await register({}, form())).error).toContain("15 minutes");
  expect(mocks.register).not.toHaveBeenCalled();
});
test("an existing email produces an actionable response without authentication", async () => {
  mocks.register.mockRejectedValue(
    Object.assign(new Error(), { code: "P2002" }),
  );
  expect((await register({}, form())).error).toContain("invitation");
  expect(mocks.createSession).not.toHaveBeenCalled();
});
test("import rejects unauthorized workspace before calling Shopify", async () => {
  const f = new FormData();
  f.set("shopId", "foreign-shop");
  mocks.findShop.mockResolvedValue({ workspaceId: "other", status: "ACTIVE" });
  mocks.authorize.mockRejectedValue(new Error("denied"));
  await expect(importShop({}, f)).rejects.toThrow("denied");
  expect(mocks.authorize).toHaveBeenCalledWith("other", ["OWNER", "MANAGER"]);
  expect(mocks.sync).not.toHaveBeenCalled();
});
