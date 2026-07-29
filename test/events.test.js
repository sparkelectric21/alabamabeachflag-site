import test from "node:test";
import assert from "node:assert/strict";
import { refreshEmptyState, statusSummary, validateEventDraft } from "../admin/events/core.js";

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

test("refresh status card explains every important empty state", () => {
  assert.equal(refreshEmptyState(null), "Refresh has not run yet");
  assert.equal(refreshEmptyState({ status: "disabled" }), "Beach event ingestion is disabled");
  assert.equal(refreshEmptyState({ status: "monitorOnly" }), "Provider is in monitor-only mode");
  assert.equal(refreshEmptyState({ status: "failed" }), "Provider refresh failed");
  assert.equal(refreshEmptyState({ status: "healthy", counts: { raw: 0 } }), "Refresh succeeded, but no beach-specific events were found");
  assert.equal(refreshEmptyState({ status: "healthy", counts: { raw: 4, matched: 0 } }), "Events were fetched, but none matched a supported beach");
});

test("events admin exposes protected manual refresh and responsive status layout", async () => {
  const fs = await import("node:fs/promises");
  const html = await fs.readFile(new URL("../admin/events/index.html", import.meta.url), "utf8");
  const js = await fs.readFile(new URL("../admin/events/events.js", import.meta.url), "utf8");
  const css = await fs.readFile(new URL("../admin/events/events.css", import.meta.url), "utf8");
  assert.match(html, /Source Refresh/);
  assert.match(html, /Refresh event sources/);
  assert.match(html, /Beach coverage/);
  assert.match(html, /Excluded/);
  assert.match(html, /assignment-dialog/);
  assert.match(html, /aria-live="polite"/);
  assert.match(js, /\/internal\/refresh\/beach-events/);
  assert.match(js, /Assignment creates a pending-review event\. It never publishes directly\./);
  assert.match(js, /No active provider coverage/);
  assert.match(js, /reasonDetail/);
  assert.match(js, /updateBannerPreview/);
  assert.match(js, /control\.disabled=true/);
  assert.match(js, /Refresh status unavailable/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /max-width:600px/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
});
