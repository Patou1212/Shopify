import { db } from "@/lib/db";
import { hashPassword } from "@/lib/account";
import { defaultShopLimit } from "@/lib/onboarding";
export async function registerAccount(
  name: string,
  email: string,
  password: string,
) {
  const passwordHash = hashPassword(password);
  return db.$transaction(async (tx) => {
    // create, never upsert: registration cannot claim an invited/existing account.
    const account = await tx.account.create({
      data: { name, email, passwordHash },
    });
    const workspace = await tx.workspace.create({
      data: {
        name: `Espace de ${name}`,
        plan: "Accès découverte",
        shopLimit: defaultShopLimit(),
      },
    });
    await tx.membership.create({
      data: { accountId: account.id, workspaceId: workspace.id, role: "OWNER" },
    });
    await tx.platformEvent.create({
      data: {
        actorId: account.id,
        action: "SELF_REGISTER",
        target: workspace.id,
        details: "Création autonome du compte et de son espace",
      },
    });
    return account;
  });
}
