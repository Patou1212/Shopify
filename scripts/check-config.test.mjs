import { test } from "node:test";
import assert from "node:assert/strict";
import { configErrors } from "./check-config.mjs";
const valid = {
  DATABASE_URL: "postgresql://local:example@localhost/stockify",
  APP_URL: "https://stockify.example",
  APP_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  SHOPIFY_CLIENT_ID: "test",
  SHOPIFY_CLIENT_SECRET: "test",
  NODE_ENV: "production",
};
test("valid production configuration passes", () =>
  assert.deepEqual(configErrors(valid), []));
test("missing secrets are named but never disclosed", () => {
  const errors = configErrors({ ...valid, SHOPIFY_CLIENT_SECRET: "" });
  assert.deepEqual(errors, ["SHOPIFY_CLIENT_SECRET manque."]);
});
test("rejects insecure production URL, invalid database and key", () => {
  assert.equal(
    configErrors({
      ...valid,
      APP_URL: "http://example.com",
      DATABASE_URL: "https://example.com",
      APP_ENCRYPTION_KEY: "invalid",
    }).length,
    3,
  );
});
test("rejects callback path in APP_URL and missing scopes", () => {
  assert.equal(
    configErrors({
      ...valid,
      APP_URL: "https://example.com/callback",
      SHOPIFY_SCOPES: "read_products",
    }).length,
    4,
  );
});
