import { expect, test, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  invite: vi.fn(),
  session: vi.fn(),
  transaction: vi.fn(),
  createSession: vi.fn(),
  hash: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: { findUnique: mock.invite },
    $transaction: mock.transaction,
  },
}));
vi.mock("@/lib/account", () => ({
  saasEnabled: () => true,
  throttle: async () => true,
  digest: (s: string) => s,
  accountSession: mock.session,
  hashPassword: mock.hash,
  createSession: mock.createSession,
}));
vi.mock("@/lib/session", () => ({ sessionToken: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logConnection: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));
import { activate } from "@/app/account/actions";
function form() {
  const f = new FormData();
  f.set("token", "a".repeat(64));
  f.set("password", "long-password-example");
  return f;
}
const invite = {
  id: "inv",
  accountId: "a",
  workspaceId: "w",
  role: "VIEWER",
  usedAt: null,
  expiresAt: new Date(Date.now() + 60000),
  account: { passwordHash: "existing", disabled: false },
  workspace: { suspended: false },
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.invite.mockResolvedValue(invite);
  mock.session.mockResolvedValue(null);
});
test("invitation cannot reset or take over an existing account", async () => {
  const result = await activate({}, form());
  expect(result.error).toContain("existe déjà");
  expect(mock.transaction).not.toHaveBeenCalled();
  expect(mock.createSession).not.toHaveBeenCalled();
});
test("consumed and expired invitation never opens a session", async () => {
  mock.invite.mockResolvedValue({ ...invite, usedAt: new Date() });
  expect((await activate({}, form())).error).toBeTruthy();
  mock.invite.mockResolvedValue({ ...invite, expiresAt: new Date(0) });
  expect((await activate({}, form())).error).toBeTruthy();
  expect(mock.transaction).not.toHaveBeenCalled();
  expect(mock.createSession).not.toHaveBeenCalled();
});
test("concurrent consumption failure cannot create membership or authenticate", async () => {
  mock.invite.mockResolvedValue({
    ...invite,
    account: { passwordHash: null, disabled: false },
  });
  mock.hash.mockReturnValue("hash");
  const membership = vi.fn();
  mock.transaction.mockImplementation((fn) =>
    fn({
      invitation: { updateMany: async () => ({ count: 0 }) },
      membership: { upsert: membership },
    }),
  );
  expect((await activate({}, form())).error).toBeTruthy();
  expect(membership).not.toHaveBeenCalled();
  expect(mock.createSession).not.toHaveBeenCalled();
});
