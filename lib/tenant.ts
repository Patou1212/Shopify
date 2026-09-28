import { ShopLinkError } from "@/lib/onboarding";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { SHOPIFY_API_VERSION } from "@/lib/shopify/config";
export function canAccessShop(
  member: {
    role: string;
    workspaceId: string;
    workspace: { suspended: boolean };
  } | null,
  workspaceId: string | null,
  write = false,
) {
  return (
    !!member &&
    !!workspaceId &&
    member.workspaceId === workspaceId &&
    !member.workspace.suspended &&
    (write ? ["OWNER", "MANAGER"] : ["OWNER", "MANAGER", "VIEWER"]).includes(
      member.role,
    )
  );
}
export function assertLinkAllowed(
  workspace: { suspended: boolean; shopLimit: number },
  count: number,
  existingWorkspace: string | null | undefined,
  workspaceId: string,
) {
  if (workspace.suspended)
    throw new ShopLinkError("workspace_unavailable", "Espace suspendu.");
  if (existingWorkspace !== undefined && existingWorkspace !== workspaceId)
    throw new ShopLinkError(
      existingWorkspace === null ? "shop_unassigned" : "shop_owned",
      "Cette boutique est déjà enregistrée. Contactez Stockify.",
    );
  if (existingWorkspace === undefined && count >= workspace.shopLimit)
    throw new ShopLinkError("shop_limit", "Quota de boutiques atteint.");
}
export async function linkShop(input: {
  workspaceId: string;
  accountId: string;
  domain: string;
  shopifyId: string;
  name: string;
  accessToken: string;
  scope: string;
}) {
  return db.$transaction(async (tx) => {
    // Serialize aliases of the same Shopify shop, including across workspaces.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.shopifyId}))`;
    const workspace = await tx.workspace.update({
      where: { id: input.workspaceId },
      data: { updatedAt: new Date() },
    });
    const member = await tx.membership.findUnique({
      where: {
        accountId_workspaceId: {
          accountId: input.accountId,
          workspaceId: input.workspaceId,
        },
      },
      include: { account: true },
    });
    if (member?.role !== "OWNER" || member.account.disabled)
      throw new Error("Accès refusé.");
    const matches = await tx.shop.findMany({
      where: {
        OR: [{ domain: input.domain }, { shopifyShopId: input.shopifyId }],
      },
    });
    if (matches.length > 1)
      throw new Error("Doublon historique à résoudre par l’administrateur.");
    const existing = matches[0];
    const count = await tx.shop.count({ where: { workspaceId: workspace.id } });
    assertLinkAllowed(workspace, count, existing?.workspaceId, workspace.id);
    const data = {
      name: input.name,
      shopifyShopId: input.shopifyId,
      encryptedAccessToken: encryptSecret(input.accessToken),
      grantedScopes: input.scope,
      apiVersion: SHOPIFY_API_VERSION,
      status: "ACTIVE" as const,
      connectedAt: new Date(),
    };
    const shop = existing
      ? await tx.shop.update({ where: { id: existing.id }, data })
      : await tx.shop.create({
          data: { ...data, domain: input.domain, workspaceId: workspace.id },
        });
    await tx.platformEvent.create({
      data: {
        actorId: input.accountId,
        action: "LINK_SHOP",
        target: workspace.id,
        details: shop.domain,
      },
    });
    return shop;
  });
}
