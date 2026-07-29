import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUDIT_ENDPOINT, CONTROL_ENDPOINT, IMPACT, auditRecordFields, auditUrl, canApplyTransition, classifyAuditFailure, classifyControlFailure, confirmationMatches, criticalConfirmationPhrase, expiryForPreset, parseAuditPage, publicRevisionStatus, requiresCriticalConfirmation, summarizeControls, validateTransition } from "../admin/operational-control/core.js";

test("uses protected same-origin operational-control endpoint", () => assert.equal(CONTROL_ENDPOINT, "/admin/service/admin/operational-control"));
test("previews provider inheritance and independent Orange Beach impact", () => { assert.match(IMPACT["providers.gulfShoresFlags"], /Fort Morgan/); assert.match(IMPACT["providers.orangeBeachFlags"], /Orange Beach locations only/); });
test("requires critical confirmation for broad disables", () => { assert.equal(requiresCriticalConfirmation("global.liveData", "disabled"), true); assert.equal(requiresCriticalConfirmation("providers.orangeBeachFlags", "disabled"), false); });
test("validates expiry and restore reasons", () => { const now = new Date("2026-07-21T20:00:00Z"); assert.deepEqual(validateTransition({ controlId: "domains.beachFlags", state: "disabled", reasonCode: "data_integrity", operatorReason: "Mismatch", expiresAt: expiryForPreset("1h", now) }, now), {}); assert.ok(validateTransition({ controlId: "domains.beachFlags", state: "disabled", reasonCode: "", operatorReason: "", expiresAt: null }, now).expiresAt); });
test("surfaces revision conflicts", () => assert.match(classifyControlFailure({ status: 412, redirected: false }), /another session/));
test("uses protected same-origin audit endpoint and safely encodes cursors", () => { assert.equal(AUDIT_ENDPOINT, "/admin/service/admin/operational-control/audit"); assert.equal(auditUrl(), AUDIT_ENDPOINT); assert.equal(auditUrl("next page&token"), `${AUDIT_ENDPOINT}?cursor=next+page%26token`); });
test("accepts empty and paginated audit pages", () => { assert.deepEqual(parseAuditPage({ audit: [], cursor: null }), { records: [], cursor: null }); assert.deepEqual(parseAuditPage({ audit: [{ auditId: "1" }], cursor: "next" }), { records: [{ auditId: "1" }], cursor: "next" }); });
test("rejects malformed audit responses", () => { for (const payload of [null, {}, { audit: {} }, { audit: [null] }, { audit: [], cursor: 7 }]) assert.throws(() => parseAuditPage(payload), /Malformed/); });
test("formats audit records without requiring optional fields", () => {
  const fields = Object.fromEntries(auditRecordFields({ timestamp: "2026-07-21T20:00:00.000Z", actor: "operator@example.com", action: "transition", controlId: "domains.beachFlags", previousState: "enabled", nextState: "disabled", reasonCode: "data_integrity", operatorReason: "Mismatch", resultingRevision: "rev-2" }));
  assert.equal(fields.Action, "Disable"); assert.equal(fields.State, "enabled → disabled"); assert.equal(fields.Revision, "rev-2"); assert.doesNotThrow(() => auditRecordFields({ action: "rollback" })); assert.equal(Object.fromEntries(auditRecordFields({ action: "rollback" })).Action, "Rollback");
});
test("distinguishes audit Access failures from API failures", () => { assert.match(classifyAuditFailure({ status: 403, redirected: false }), /Access session/); assert.match(classifyAuditFailure({ status: 500, redirected: false }), /could not be loaded/); });
test("requires exact broad-disable phrases after trimming", () => {
  assert.equal(criticalConfirmationPhrase("global.liveData", "disabled"), "DISABLE LIVE DATA"); assert.equal(criticalConfirmationPhrase("domains.beachFlags", "disabled"), "DISABLE BEACH FLAGS"); assert.equal(confirmationMatches("DISABLE LIVE DATA", " DISABLE LIVE DATA \n"), true); assert.equal(confirmationMatches("DISABLE LIVE DATA", "DISABLE LIVE"), false); assert.equal(confirmationMatches("DISABLE BEACH FLAGS", "disable beach flags"), false);
});
test("keeps provider actions and restores on explicit button confirmation", () => { assert.equal(criticalConfirmationPhrase("providers.gulfShoresFlags", "disabled"), null); assert.equal(criticalConfirmationPhrase("global.liveData", "enabled"), null); assert.equal(confirmationMatches(null, ""), true); });
test("summarizes active, monitor-only, disabled, and review-required controls", () => {
  const now = new Date("2026-07-28T12:00:00Z");
  assert.deepEqual(summarizeControls({ a: { state: "enabled" }, b: { state: "monitorOnly", expiresAt: "2026-07-28T13:00:00Z" }, c: { state: "disabled", expiresAt: "2026-07-28T13:00:00Z" }, d: { state: "monitorOnly", expiresAt: "2026-07-28T11:00:00Z", onExpiry: "require_review" } }, now), { total: 4, monitorOnly: 1, disabled: 2, expiredReview: 1, notEnabled: 3 });
});
test("compares protected and public revisions without claiming provider health", () => {
  assert.deepEqual(publicRevisionStatus("rev-2", "rev-2"), { label: "Public revision confirmed", confirmed: true });
  assert.equal(publicRevisionStatus("rev-2", "rev-1").confirmed, false);
});
test("requires valid reason, duration, revision, and phrase before apply", () => {
  const now = new Date("2026-07-21T20:00:00Z"); const draft = { controlId: "global.liveData", state: "disabled", reasonCode: "incident_response", operatorReason: "Confirmed bad live data", expiresAt: expiryForPreset("1h", now) }; const base = { draft, now, revision: "rev-1", requiredPhrase: "DISABLE LIVE DATA", confirmation: "DISABLE LIVE DATA" };
  assert.equal(canApplyTransition(base), true); assert.equal(canApplyTransition({ ...base, revision: null }), false); assert.equal(canApplyTransition({ ...base, confirmation: "DISABLE" }), false); assert.equal(canApplyTransition({ ...base, draft: { ...draft, operatorReason: "" } }), false); assert.equal(canApplyTransition({ ...base, draft: { ...draft, expiresAt: null } }), false);
});
test("audit refresh and pagination remain GET-only", () => {
  const source = readFileSync(new URL("../admin/operational-control/operational-control.js", import.meta.url), "utf8");
  const auditFetches = source.split("\n").filter((line) => line.includes("fetch(auditUrl"));
  assert.equal(auditFetches.length, 1);
  assert.match(auditFetches[0], /method: "GET"/);
  assert.doesNotMatch(auditFetches[0], /"(?:PATCH|POST|PUT|DELETE)"/);
});
test("opening or cancelling review cannot issue a mutation", () => {
  const source = readFileSync(new URL("../admin/operational-control/operational-control.js", import.meta.url), "utf8");
  assert.match(source, /returnValue = "";[\s\S]*?showModal\(\)/);
  assert.match(source, /if \(!confirmed\) return;[\s\S]*?method: "PATCH"/);
});
test("includes emergency response workflows and a production-mutation guard", () => {
  const html = readFileSync(new URL("../admin/operational-control/index.html", import.meta.url), "utf8");
  assert.match(html, /Emergency response/); assert.match(html, /With Codex/); assert.match(html, /Without Codex/);
  assert.match(html, /Do not mutate production/); assert.match(html, /unavailable is safer/);
  assert.match(html, /Provider Health/); assert.match(html, /Public v2 flags/);
});
