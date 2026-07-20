import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, classifyFailure, expirationForPreset, localInputValue, payloadFromDraft, validateDraft } from "../admin/core.js";

const base = { id: "notice-1", title: "Service notice", message: "Updates may be delayed.", severity: "information", startsAt: "2026-07-20T12:00", expiresAt: "2026-07-20T13:00", actionTitle: "", actionUrl: "" };
const now = new Date("2026-07-20T12:30:00Z");

test("validates a complete draft and converts local dates to canonical UTC", () => {
  assert.deepEqual(validateDraft(base, new Date("2026-07-20T11:00:00Z")), {});
  const payload = payloadFromDraft(base);
  assert.match(payload.startsAt, /^2026-07-20T\d{2}:00:00\.000Z$/);
  assert.equal(payload.actionTitle, null); assert.equal(payload.actionUrl, null);
});
test("rejects missing content and unsupported severity", () => {
  const errors = validateDraft({ ...base, id: "bad id", title: "", message: "<b>unsafe</b>", severity: "warning" }, new Date("2026-07-20T11:00:00Z"));
  assert.ok(errors.id && errors.title && errors.message && errors.severity);
});
test("rejects reversed or elapsed ranges", () => {
  assert.ok(validateDraft({ ...base, expiresAt: "2026-07-20T11:00" }, now).expiresAt);
  assert.ok(validateDraft({ ...base, startsAt: "2026-07-20T14:00", expiresAt: "2026-07-20T13:00" }, now).expiresAt);
});
test("validates optional actions as a pair on approved HTTPS hosts", () => {
  assert.ok(validateDraft({ ...base, actionTitle: "Learn", actionUrl: "" }, new Date("2026-07-20T11:00:00Z")).action);
  assert.ok(validateDraft({ ...base, actionTitle: "Learn", actionUrl: "https://example.com" }, new Date("2026-07-20T11:00:00Z")).actionUrl);
  assert.deepEqual(validateDraft({ ...base, actionTitle: "Learn", actionUrl: "https://www.alabamabeachflag.com/help" }, new Date("2026-07-20T11:00:00Z")), {});
});
test("expiration presets are based on the selected start", () => {
  const start = new Date("2026-07-20T12:00:00Z");
  assert.equal(expirationForPreset("30m", start).toISOString(), "2026-07-20T12:30:00.000Z");
  assert.equal(expirationForPreset("4h", start).toISOString(), "2026-07-20T16:00:00.000Z");
});
test("templates populate editable values without network behavior", () => {
  assert.equal(TEMPLATES["provider-delay"].severity, "important");
  assert.equal(TEMPLATES.custom.title, "");
});
test("failure classes distinguish access, validation, server, and network failures", () => {
  assert.match(classifyFailure({ status: 403 }), /Access was denied/);
  assert.match(classifyFailure({ status: 400 }), /rejected/);
  assert.match(classifyFailure({ status: 503 }), /unavailable/);
  assert.match(classifyFailure({ network: true }), /Could not reach/);
  assert.match(classifyFailure({ redirected: true }), /expired/);
});
test("local input formatting produces a datetime-local value", () => assert.match(localInputValue(new Date()), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/));
