import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function configErrors(env) {
  const errors = [];
  for (const name of [
    "DATABASE_URL",
    "APP_URL",
    "APP_ENCRYPTION_KEY",
    "SHOPIFY_CLIENT_ID",
    "SHOPIFY_CLIENT_SECRET",
  ]) {
    if (!env[name]?.trim()) errors.push(`${name} manque.`);
  }
  if (env.DATABASE_URL) {
    try {
      if (
        !["postgres:", "postgresql:"].includes(
          new URL(env.DATABASE_URL).protocol,
        )
      )
        throw new Error();
    } catch {
      errors.push("DATABASE_URL doit désigner une base PostgreSQL.");
    }
  }
  if (env.APP_URL) {
    try {
      const url = new URL(env.APP_URL);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        throw new Error();
      if (env.NODE_ENV === "production" && url.protocol !== "https:")
        errors.push("APP_URL doit utiliser HTTPS en production.");
    } catch {
      errors.push(
        "APP_URL doit être une origine HTTP(S), sans chemin ni paramètres.",
      );
    }
  }
  if (
    env.APP_ENCRYPTION_KEY &&
    (!/^[A-Za-z0-9+/]{43}=$/.test(env.APP_ENCRYPTION_KEY) ||
      Buffer.from(env.APP_ENCRYPTION_KEY, "base64").length !== 32)
  )
    errors.push("APP_ENCRYPTION_KEY doit contenir 32 octets en base64.");
  if (env.SHOPIFY_API_VERSION && env.SHOPIFY_API_VERSION !== "2026-07")
    errors.push(
      "Cette version de Stockify est validée pour SHOPIFY_API_VERSION=2026-07.",
    );
  const scopes = (
    env.SHOPIFY_SCOPES ||
    "read_products,read_inventory,write_inventory,read_locations"
  )
    .split(",")
    .map((s) => s.trim());
  for (const scope of [
    "read_products",
    "read_inventory",
    "write_inventory",
    "read_locations",
  ])
    if (!scopes.includes(scope)) errors.push(`Scope manquant : ${scope}.`);
  return errors;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const errors = configErrors(process.env);
  errors.forEach((error) => console.error(error));
  if (!errors.length)
    console.log(
      "Configuration valide. La connectivité Shopify et PostgreSQL reste à vérifier.",
    );
  process.exitCode = errors.length ? 1 : 0;
}
