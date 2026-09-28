"use server";
import { registerAccount } from "@/lib/registration";
import { synchronize } from "@/lib/shopify/sync";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  accountSession,
  requireAccount,
  requireWorkspace,
  requireAdmin,
  digest,
  newToken,
  hashPassword,
  verifyPassword,
  createSession,
  cookieOptions,
  throttle,
  saasEnabled,
} from "@/lib/account";
import { logConnection } from "@/lib/audit";
import { sessionToken } from "@/lib/session";
type Result = { error?: string; link?: string };
const field = (f: FormData, k: string) => String(f.get(k) || "").trim();
export async function login(_: Result, form: FormData): Promise<Result> {
  if (!saasEnabled())
    return { error: "Les comptes Stockify ne sont pas encore activés." };
  const email = field(form, "email").toLowerCase();
  if (!(await throttle(`login:${email}`)))
    return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
  const account = await db.account.findUnique({ where: { email } });
  const password = String(form.get("password") || "");
  // Also perform password work for unknown accounts.
  const valid = verifyPassword(
    password,
    account?.passwordHash || `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  if (!account || account.disabled || !valid)
    return { error: "Identifiants incorrects." };
  await createSession(account.id);
  redirect("/account");
}
export async function logout() {
  const session = await accountSession();
  if (session)
    await db.accountSession.deleteMany({ where: { id: session.id } });
  const jar = await cookies();
  jar.delete("stockify_account");
  jar.delete("stockify_session");
  redirect("/account/login");
}
export async function activate(_: Result, form: FormData): Promise<Result> {
  if (!saasEnabled()) return { error: "Activation indisponible." };
  const token = field(form, "token");
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "Invitation invalide." };
  if (!(await throttle(`invite:${digest(token)}`)))
    return { error: "Trop de tentatives. Réessayez plus tard." };
  const invite = await db.invitation.findUnique({
    where: { tokenHash: digest(token) },
    include: { account: true, workspace: true },
  });
  if (
    !invite ||
    invite.usedAt ||
    invite.expiresAt <= new Date() ||
    invite.account.disabled ||
    invite.workspace.suspended
  )
    return { error: "Invitation expirée ou indisponible." };
  const current = await accountSession();
  if (invite.account.passwordHash && current?.accountId !== invite.accountId)
    return {
      error:
        "Ce compte existe déjà. Connectez-vous avec son adresse e-mail, puis rouvrez ce lien.",
    };
  let passwordHash: string | undefined;
  try {
    if (!invite.account.passwordHash)
      passwordHash = hashPassword(String(form.get("password") || ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  try {
    await db.$transaction(async (tx) => {
      const used = await tx.invitation.updateMany({
        where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw new Error("Invitation déjà utilisée.");
      // Never overwrite a password set concurrently by another invitation.
      if (passwordHash) {
        const updated = await tx.account.updateMany({
          where: { id: invite.accountId, passwordHash: null, disabled: false },
          data: { passwordHash },
        });
        if (updated.count !== 1)
          throw new Error("Compte déjà activé. Connectez-vous puis réessayez.");
      }
      await tx.membership.upsert({
        where: {
          accountId_workspaceId: {
            accountId: invite.accountId,
            workspaceId: invite.workspaceId,
          },
        },
        create: {
          accountId: invite.accountId,
          workspaceId: invite.workspaceId,
          role: invite.role,
        },
        update: {},
      });
    });
  } catch {
    return {
      error:
        "Invitation déjà utilisée ou compte activé. Connectez-vous puis réessayez.",
    };
  }
  await createSession(invite.accountId);
  redirect("/account");
}
export async function selectShop(form: FormData) {
  const session = await requireAccount();
  const shop = await db.shop.findUnique({
    where: { id: field(form, "shopId") },
  });
  if (!shop?.workspaceId || shop.status !== "ACTIVE")
    throw new Error("Boutique indisponible.");
  await requireWorkspace(shop.workspaceId);
  await logConnection(shop.id, session.accountId, false);
  (await cookies()).set(
    "stockify_session",
    sessionToken(shop.id, session.accountId),
    cookieOptions,
  );
  redirect("/inventory");
}
export async function inviteMember(_: Result, form: FormData): Promise<Result> {
  const workspaceId = field(form, "workspaceId");
  const { session } = await requireWorkspace(workspaceId, ["OWNER"]);
  const email = field(form, "email").toLowerCase();
  const name = field(form, "name");
  const role = field(form, "role");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 100 ||
    !["MANAGER", "VIEWER"].includes(role)
  )
    return { error: "Vérifiez l’adresse, le nom et le rôle." };
  const token = newToken();
  await db.$transaction(async (tx) => {
    const account = await tx.account.upsert({
      where: { email },
      create: { email, name },
      update: {},
    });
    await tx.invitation.create({
      data: {
        accountId: account.id,
        workspaceId,
        role,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await tx.platformEvent.create({
      data: {
        actorId: session.accountId,
        action: "INVITE",
        target: workspaceId,
        details: email + ":" + role,
      },
    });
  });
  return { link: `/account/activate?token=${token}` };
}
export async function createClient(_: Result, form: FormData): Promise<Result> {
  const session = await requireAdmin();
  const email = field(form, "email").toLowerCase();
  const name = field(form, "name");
  const limit = Number(form.get("shopLimit"));
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 100 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  )
    return { error: "Vérifiez le nom, l’e-mail et le quota (1 à 1000)." };
  const token = newToken();
  await db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        shopLimit: limit,
        plan: field(form, "plan").slice(0, 50) || "Solo",
      },
    });
    const account = await tx.account.upsert({
      where: { email },
      create: { email, name },
      update: {},
    });
    await tx.invitation.create({
      data: {
        accountId: account.id,
        workspaceId: workspace.id,
        role: "OWNER",
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await tx.platformEvent.create({
      data: {
        actorId: session.accountId,
        action: "CREATE_CLIENT",
        target: workspace.id,
        details: `${email}; quota=${limit}`,
      },
    });
  });
  revalidatePath("/admin");
  return { link: `/account/activate?token=${token}` };
}
export async function updateClient(form: FormData) {
  const session = await requireAdmin();
  const id = field(form, "workspaceId");
  const limit = Number(form.get("shopLimit"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw new Error("Quota invalide.");
  await db.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id },
      data: {
        shopLimit: limit,
        plan: field(form, "plan").slice(0, 50),
        suspended: form.get("suspended") === "on",
      },
    });
    await tx.platformEvent.create({
      data: {
        actorId: session.accountId,
        action: "UPDATE_CLIENT",
        target: id,
        details: `quota=${limit}; suspended=${form.get("suspended") === "on"}`,
      },
    });
  });
  revalidatePath("/admin");
}

export async function register(_: Result, form: FormData): Promise<Result> {
  if (!saasEnabled() || process.env.STOCKIFY_PUBLIC_SIGNUP === "false")
    return { error: "Les inscriptions sont momentanément fermées." };
  const name = field(form, "name"),
    email = field(form, "email").toLowerCase();
  const password = String(form.get("password") || "");
  if (
    !name ||
    name.length > 100 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return { error: "Renseignez votre nom et une adresse e-mail valide." };
  if (password.length < 12 || password.length > 256)
    return { error: "Choisissez un mot de passe de 12 à 256 caractères." };
  if (password !== String(form.get("confirmPassword") || ""))
    return { error: "Les deux mots de passe ne correspondent pas." };
  if (field(form, "website")) return { error: "Inscription indisponible." };
  if (
    !(await throttle(`register:${email}`)) ||
    !(await throttle("register-global"))
  )
    return {
      error: "Trop de tentatives d’inscription. Réessayez dans 15 minutes.",
    };
  let account;
  try {
    account = await registerAccount(name, email, password);
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "P2002")
      return {
        error:
          "Cette adresse est déjà enregistrée ou invitée. Connectez-vous ou utilisez votre invitation.",
      };
    return {
      error:
        "Impossible de créer votre compte pour le moment. Réessayez dans quelques instants.",
    };
  }
  await createSession(account.id);
  (await cookies()).delete("stockify_session");
  redirect("/account?welcome=1");
}

export async function importShop(
  _: { error?: string; message?: string },
  form: FormData,
): Promise<{ error?: string; message?: string }> {
  await requireAccount();
  const shop = await db.shop.findUnique({
    where: { id: field(form, "shopId") },
  });
  if (!shop?.workspaceId || shop.status !== "ACTIVE")
    return {
      error: "Boutique indisponible. Reconnectez-la depuis Mes boutiques.",
    };
  await requireWorkspace(shop.workspaceId, ["OWNER", "MANAGER"]);
  try {
    const result = await synchronize(shop);
    revalidatePath("/account");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return {
      message: `Import terminé : ${result.variants} variantes et ${result.locations} emplacements disponibles.`,
    };
  } catch {
    return {
      error:
        "L’import n’a pas abouti. Vos données précédentes sont conservées. Réessayez dans quelques instants ; si l’autorisation Shopify a été retirée, reconnectez la boutique.",
    };
  }
}
