import test from "node:test";
import assert from "node:assert/strict";
import { AdminRequestError, centralInputValue, centralWallTimeToIso, formatCentralTime, requestJson } from "../admin/shared.js";

test("Central Time formatting is explicit and browser-zone independent", () => {
  assert.match(formatCentralTime("2026-01-15T18:30:00Z"), /Jan 15, 2026, 12:30 PM CST/);
  assert.match(formatCentralTime("2026-07-15T17:30:00Z"), /Jul 15, 2026, 12:30 PM CDT/);
  assert.equal(centralInputValue("2026-07-15T17:30:00Z"), "2026-07-15T12:30");
});
test("Central wall-time policy rejects gaps and chooses first overlap occurrence", () => {
  assert.throws(() => centralWallTimeToIso("2026-03-08T02:30"), /does not exist/);
  assert.equal(centralWallTimeToIso("2026-11-01T01:30"), "2026-11-01T06:30:00.000Z");
  assert.equal(centralWallTimeToIso("2026-11-01T01:30", "later"), "2026-11-01T07:30:00.000Z");
});
test("requestJson preserves HTTP payload and classification", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Invalid", fields: ["title"] }), { status: 400, headers: { "content-type": "application/json" } });
  try { await assert.rejects(requestJson("/test"), error => error instanceof AdminRequestError && error.kind === "http" && error.status === 400 && error.payload.fields[0] === "title"); }
  finally { globalThis.fetch = original; }
});
test("requestJson distinguishes access HTML, malformed JSON, and transport failures", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("login", { status: 200, headers: { "content-type": "text/html" } });
    await assert.rejects(requestJson("/test"), error => error.kind === "access");
    globalThis.fetch = async () => new Response("{", { status: 200, headers: { "content-type": "application/json" } });
    await assert.rejects(requestJson("/test"), error => error.kind === "malformed");
    globalThis.fetch = async () => { throw new TypeError("offline"); };
    await assert.rejects(requestJson("/test"), error => error.kind === "transport");
  } finally { globalThis.fetch = original; }
});
