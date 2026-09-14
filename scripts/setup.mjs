import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
if (existsSync(".env")) {
  console.log("Le fichier .env existe déjà : aucune modification.");
} else {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env",
    `POSTGRES_PASSWORD="${password}"\nDATABASE_URL="postgresql://stockify:${password}@localhost:5432/stockify?schema=public"\nAPP_URL="http://localhost:3000"\nAPP_ENCRYPTION_KEY="${randomBytes(32).toString("base64")}"\nSHOPIFY_CLIENT_ID=""\nSHOPIFY_CLIENT_SECRET=""\nSHOPIFY_API_VERSION="2026-07"\nSHOPIFY_SCOPES="read_products,read_inventory,write_inventory,read_locations"\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Configuration locale créée. Renseignez les identifiants Shopify dans .env.",
  );
}
