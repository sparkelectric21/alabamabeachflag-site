import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const headers = readFileSync(new URL("../_headers", import.meta.url), "utf8");
const adminRule = headers.match(/\/admin\/\*[\s\S]*?(?=\n\S|$)/)?.[0] ?? "";

test("admin hosting uses a no-store same-origin security perimeter", () => {
  assert.match(adminRule, /Cache-Control: no-store, max-age=0/);
  assert.match(adminRule, /default-src 'self'/);
  assert.match(adminRule, /connect-src 'self'/);
  assert.match(adminRule, /object-src 'none'/);
  assert.match(adminRule, /base-uri 'self'/);
  assert.match(adminRule, /frame-ancestors 'none'/);
  assert.match(adminRule, /form-action 'self'/);
  assert.match(adminRule, /X-Content-Type-Options: nosniff/);
  assert.match(adminRule, /X-Frame-Options: DENY/);
});

test("admin CSP does not permit either direct Worker origin", () => {
  assert.doesNotMatch(adminRule, /alabamabeachflag-api(?:-staging)?\./);
  assert.doesNotMatch(adminRule, /https:\/\/\*/);
});
