import test from "node:test";
import assert from "node:assert/strict";
import { statusSummary, validateEventDraft } from "../admin/events/core.js";

const valid = {
  title: "Beach Cleanup", beachId: "gulf-shores-public-beach", venue: "Gulf Place",
  startAt: "2026-08-01T13:00:00Z", endAt: "2026-08-01T15:00:00Z",
  eventType: "beachCleanup", impactLevel: "informational",
  bannerTitle: "Beach cleanup here today", bannerMessage: "An activity is scheduled.",
  sourceURL: "https://example.gov/event"
};

test("manual event validation requires exact fields, ordered dates, known classifications, and HTTPS", () => {
  assert.deepEqual(validateEventDraft(valid), {});
  assert.deepEqual(Object.keys(validateEventDraft({ ...valid, beachId: "", endAt: valid.startAt, eventType: "unknown", sourceURL: "http://example.com" })).sort(), ["beachId", "dates", "eventType", "sourceURL"]);
});

test("event status summary supports the review dashboard", () => {
  assert.deepEqual(statusSummary([{ status: "pendingReview" }, { status: "published" }, { status: "pendingReview" }]), { pendingReview: 2, published: 1 });
});
