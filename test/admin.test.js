import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_URL_POLICY_MESSAGE, TEMPLATES, centralDateId, centralInputToUtc, classifyFailure, expirationForPreset, isApprovedAnnouncementActionUrl, jellyfishTemplateDraft, localInputValue, payloadFromDraft, validateDraft } from "../admin/core.js";

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
test("announcement action policy allows exact first-party and Red Cross first-aid URLs", () => {
  for (const url of [
    "https://alabamabeachflag.com/resources/jellyfish-stings",
    "https://www.alabamabeachflag.com/resources/jellyfish-stings",
    "https://www.redcross.org/take-a-class/resources/learn-first-aid/jellyfish-stings",
    "https://www.redcross.org/take-a-class/resources/learn-first-aid/another-topic?source=app"
  ]) assert.equal(isApprovedAnnouncementActionUrl(url), true, url);
});
test("announcement action policy rejects unsafe or unapproved destinations", () => {
  for (const url of [
    "http://www.redcross.org/take-a-class/resources/learn-first-aid/jellyfish-stings",
    "https://redcross.org.evil.example/example",
    "https://evil.example/?next=https://www.redcross.org/",
    "https://user:password@www.redcross.org/take-a-class/resources/learn-first-aid/jellyfish-stings",
    "https://www.redcross.org:8443/take-a-class/resources/learn-first-aid/jellyfish-stings",
    "https://www.redcross.org/take-a-class/resources/learn-first-aid/jellyfish-stings#section",
    "https://support.redcross.org/example",
    "https://www.redcross.org/donate/example",
    "https://localhost/resources/jellyfish-stings",
    "https://127.0.0.1/resources/jellyfish-stings"
  ]) assert.equal(isApprovedAnnouncementActionUrl(url), false, url);
  assert.equal(validateDraft({ ...base, actionTitle: "Learn", actionUrl: "https://www.redcross.org/donate/example" }, new Date("2026-07-20T11:00:00Z")).actionUrl, ACTION_URL_POLICY_MESSAGE);
});
test("optional action fields must both be present or both empty", () => {
  assert.deepEqual(validateDraft(base, new Date("2026-07-20T11:00:00Z")), {});
  assert.ok(validateDraft({ ...base, actionTitle: "Learn", actionUrl: "" }, new Date("2026-07-20T11:00:00Z")).action);
  assert.ok(validateDraft({ ...base, actionTitle: "", actionUrl: "https://alabamabeachflag.com/help" }, new Date("2026-07-20T11:00:00Z")).action);
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
test("jellyfish template fills every field using the America/Chicago date and Central midnight", () => {
  const beforeCentralMidnight = jellyfishTemplateDraft(new Date("2026-08-02T04:30:00Z"));
  const afterCentralMidnight = jellyfishTemplateDraft(new Date("2026-08-02T05:30:00Z"));
  assert.deepEqual(beforeCentralMidnight, {
    id: "jellyfish-2026-08-01",
    title: "Jellyfish Reported Along the Coast",
    message: "Jellyfish have been reported in Gulf waters along parts of the Alabama coast today. Use caution while swimming, follow posted beach flags and lifeguard guidance, and avoid touching jellyfish in the water or on the shore.",
    severity: "notice",
    startsAt: "2026-08-01T23:30",
    expiresAt: "2026-08-02T00:00",
    actionTitle: "What to Do if Stung",
    actionUrl: "https://alabamabeachflag.com/resources/jellyfish-stings"
  });
  assert.equal(afterCentralMidnight.id, "jellyfish-2026-08-02");
  assert.equal(centralDateId(new Date("2026-08-02T04:59:59Z")), "2026-08-01");
  assert.equal(centralInputToUtc(beforeCentralMidnight.expiresAt), "2026-08-02T05:00:00.000Z");
});
test("failure classes distinguish access, validation, server, and network failures", () => {
  assert.match(classifyFailure({ status: 403 }), /Access was denied/);
  assert.match(classifyFailure({ status: 400 }), /rejected/);
  assert.match(classifyFailure({ status: 503 }), /unavailable/);
  assert.match(classifyFailure({ network: true }), /Could not reach/);
  assert.match(classifyFailure({ redirected: true }), /expired/);
});
test("local input formatting produces a datetime-local value", () => assert.match(localInputValue(new Date()), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/));
