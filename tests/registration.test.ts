import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  workspace: vi.fn(),
  member: vi.fn(),
  event: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/account", () => ({ hashPassword: () => "salt:hash" }));
import { registerAccount } from "@/lib/registration";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: "account" });
  mocks.workspace.mockResolvedValue({ id: "workspace" });
  mocks.transaction.mockImplementation((fn) =>
    fn({
      account: { create: mocks.create },
      workspace: { create: mocks.workspace },
      membership: { create: mocks.member },
      platformEvent: { create: mocks.event },
    }),
  );
});
test("registration creates a private workspace with owner rights and server-defined quota", async () => {
  await registerAccount("Client", "client@example.com", "strong-password");
  expect(mocks.create).toHaveBeenCalledWith({
    data: {
      name: "Client",
      email: "client@example.com",
      passwordHash: "salt:hash",
    },
  });
  expect(mocks.workspace).toHaveBeenCalledWith({
    data: { name: "Espace de Client", plan: "Accès découverte", shopLimit: 1 },
  });
  expect(mocks.member).toHaveBeenCalledWith({
    data: { accountId: "account", workspaceId: "workspace", role: "OWNER" },
  });
});
test("existing and invited accounts cannot be claimed through registration", async () => {
  mocks.create.mockRejectedValue(
    Object.assign(new Error("unique email"), { code: "P2002" }),
  );
  await expect(
    registerAccount("Client", "invited@example.com", "strong-password"),
  ).rejects.toThrow();
  expect(mocks.workspace).not.toHaveBeenCalled();
  expect(mocks.member).not.toHaveBeenCalled();
});
