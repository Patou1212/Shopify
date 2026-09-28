import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
const db = new PrismaClient();
const [command, ...args] = process.argv.slice(2);
const usage =
  "bootstrap EMAIL NOM | assign-shop DOMAINE ESPACE_ID | reset-password EMAIL";
try {
  if (command === "bootstrap" || command === "reset-password") {
    const [rawEmail, name] = args;
    const email = (rawEmail || "").trim().toLowerCase();
    const url = new URL(process.env.APP_URL || "http://localhost:3000");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Adresse e-mail invalide");
    const token = randomBytes(32).toString("hex");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(721549)`;
      if (
        command === "bootstrap" &&
        (await tx.account.count({ where: { platformAdmin: true } }))
      )
        throw new Error("Un administrateur existe déjà. Utilisez son compte.");
      let account, workspace;
      if (command === "bootstrap") {
        if (!name) throw new Error("Nom requis");
        // Never promote an existing customer based on an email collision.
        account = await tx.account.create({
          data: { email, name, platformAdmin: true },
        });
        workspace = await tx.workspace.create({
          data: {
            name: "Stockify · Administration",
            plan: "Interne",
            shopLimit: 1,
          },
        });
      } else {
        account = await tx.account.findUniqueOrThrow({
          where: { email },
          include: { memberships: true },
        });
        const member = account.memberships[0];
        if (!member)
          throw new Error(
            "Aucun espace actif pour ce compte. Créez une nouvelle invitation.",
          );
        workspace = await tx.workspace.findUniqueOrThrow({
          where: { id: member.workspaceId },
        });
        await tx.account.update({
          where: { id: account.id },
          data: { passwordHash: null },
        });
        await tx.accountSession.deleteMany({
          where: { accountId: account.id },
        });
        await tx.invitation.updateMany({
          where: { accountId: account.id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      await tx.invitation.create({
        data: {
          accountId: account.id,
          workspaceId: workspace.id,
          role: command === "bootstrap" ? "OWNER" : account.memberships[0].role,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      await tx.platformEvent.create({
        data: {
          actorId: "SERVER_OPERATOR",
          action: command.toUpperCase(),
          target: account.id,
          details: email,
        },
      });
    });
    url.pathname = "/account/activate";
    url.searchParams.set("token", token);
    console.log(
      "Lien privé, valable 24 heures. À transmettre uniquement au titulaire :\n" +
        url.toString(),
    );
  } else if (command === "assign-shop") {
    const [domain, workspaceId] = args;
    if (!domain || !workspaceId) throw new Error(usage);
    await db.$transaction(async (tx) => {
      const w = await tx.workspace.update({
        where: { id: workspaceId },
        data: { updatedAt: new Date() },
      });
      if (
        w.suspended ||
        (await tx.shop.count({ where: { workspaceId } })) >= w.shopLimit
      )
        throw new Error("Espace suspendu ou quota atteint");
      const result = await tx.shop.updateMany({
        where: { domain, workspaceId: null },
        data: { workspaceId },
      });
      if (result.count !== 1)
        throw new Error(
          "Boutique absente ou déjà rattachée. Aucun transfert automatique.",
        );
      await tx.platformEvent.create({
        data: {
          actorId: "SERVER_OPERATOR",
          action: "ASSIGN_LEGACY_SHOP",
          target: workspaceId,
          details: domain,
        },
      });
    });
    console.log("Boutique rattachée.");
  } else throw new Error(usage);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
