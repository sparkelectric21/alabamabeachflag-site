import test from "node:test";
import assert from "node:assert/strict";
import { adminEnvironment, PRODUCTION_WORKER_ORIGIN, resolveApiURL, STAGING_WORKER_ORIGIN } from "../admin/environment.js";

test("staging resolves same-origin API paths and rejects production destinations", () => {
  assert.equal(adminEnvironment("staging.alabamabeachflag.com"), "staging");
  assert.equal(resolveApiURL("/admin/service/admin/provider-health", { environment: "staging" }), "/admin/service/admin/provider-health");
  assert.equal(resolveApiURL("/v1/beach-flags", { environment: "staging", origin: STAGING_WORKER_ORIGIN }), `${STAGING_WORKER_ORIGIN}/v1/beach-flags`);
  assert.throws(() => resolveApiURL("/v1/beach-flags", { environment: "staging", origin: PRODUCTION_WORKER_ORIGIN }), /rejected/);
});

test("production URL behavior remains explicit and the banner is staging-only", () => {
  assert.equal(adminEnvironment("www.alabamabeachflag.com"), "production");
  assert.equal(resolveApiURL("/admin/service/v1/app-configuration", { environment: "production" }), "/admin/service/v1/app-configuration");
  assert.equal(adminEnvironment("localhost"), "local");
});
