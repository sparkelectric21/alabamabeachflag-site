import test from "node:test";
import assert from "node:assert/strict";
import { archiveMatchesFilters, candidateMatchesQueue, eventMatchesQueue, eventTimingState, matchSummary, nextReviewId, refreshEmptyState, sourceChangeRows, statusSummary, validateEventDraft } from "../admin/events/core.js";

const valid = {
  title: "Beach Cleanup", beachId: "gulf-shores-public-beach", venue: "Gulf Place",
  startAt: "2026-08-01T13:00:00Z", endAt: "2026-08-01T15:00:00Z",
  eventType: "beachCleanup", impactLevel: "informational",
  bannerTitle: "Beach cleanup here today", bannerMessage: "An activity is scheduled.",
  sourceURL: "https://example.gov/event"
};

test("review timing and next-item selection are deterministic", () => { assert.equal(eventTimingState({ sourceFacts: { sourceStatus: "postponed" } }), "postponed"); assert.equal(eventTimingState({}), "unavailable"); assert.equal(eventTimingState({ startAt: "2026-08-01T13:00:00Z", endTimeUnavailable: true }), "startOnly"); assert.equal(eventTimingState({ startAt: "2026-08-01", endAt: "2026-08-02", allDay: true }), "multiDay"); assert.equal(nextReviewId(["a", "b", "c"], "a", [{ id: "a", status: "approved" }, { id: "b", status: "pendingReview" }, { id: "c", status: "approved" }]), "b"); assert.equal(nextReviewId(["a", "b"], "a", [{ id: "a", status: "approved" }]), null); });

test("manual event validation requires exact fields, ordered dates, known classifications, and HTTPS", () => {
  assert.deepEqual(validateEventDraft(valid), {});
  assert.deepEqual(Object.keys(validateEventDraft({ ...valid, beachId: "", endAt: valid.startAt, eventType: "unknown", sourceURL: "http://example.com" })).sort(), ["beachId", "dates", "eventType", "sourceURL"]);
});

test("event status summary supports the review dashboard", () => {
  assert.deepEqual(statusSummary([{ status: "pendingReview" }, { status: "published" }, { status: "pendingReview" }]), { pendingReview: 2, published: 1 });
});

test("event queues classify attention flags, provenance, and terminal states deterministically", () => {
  const base = { id: "one", status: "pendingReview", endAt: "2026-08-10T15:00:00Z", matchMethod: "exactVenue", matchConfidence: "exact", sourceFacts: { providerId: "gulfShoresCity" } };
  assert.equal(eventMatchesQueue(base, "new", new Date("2026-08-01T12:00:00Z")), true);
  assert.equal(eventMatchesQueue({ ...base, attentionFlags: ["materialSourceChange"] }, "changedAfterApproval"), true);
  assert.equal(eventMatchesQueue({ ...base, matchConfidence: "ambiguous" }, "ambiguousMatch"), true);
  assert.equal(eventMatchesQueue({ ...base, possibleDuplicateOf: "two" }, "possibleDuplicate"), true);
  assert.equal(eventMatchesQueue({ ...base, normalizationWarnings: ["bad markup"] }, "normalizationWarning"), true);
  assert.equal(eventMatchesQueue({ ...base, status: "published", attentionFlags: ["sourceMissing"] }, "publishedAttention"), true);
  assert.equal(eventMatchesQueue({ ...base, status: "cancelled" }, "removedOrCancelled"), true);
  assert.equal(eventMatchesQueue({ ...base, sourceFacts: { providerId: "manual" } }, "manual"), true);
  assert.equal(eventMatchesQueue({ ...base, status: "expired" }, "expired"), true);
  assert.equal(candidateMatchesQueue({ reason: "duplicate" }, "possibleDuplicate"), true);
  assert.equal(candidateMatchesQueue({ reason: "ambiguousLocation" }, "ambiguousMatch"), true);
});

test("review helpers explain deterministic matches and readable source diffs", () => {
  assert.equal(matchSummary({ matchMethod: "exactAddress", matchConfidence: "exact" }), "Exact beach-access address");
  assert.equal(matchSummary({ matchMethod: "adminOverride", matchConfidence: "admin" }), "Administrator assigned");
  assert.deepEqual(sourceChangeRows({ sourceChange: { materialFields: ["startAt"], cosmeticFields: ["title"], previous: { startAt: "old", title: "Cleanup" }, current: { startAt: "new", title: "Cleanup!" } } }), [
    { field: "startAt", before: "old", after: "new", material: true },
    { field: "title", before: "Cleanup", after: "Cleanup!", material: false }
  ]);
});

test("archive search and date, beach, provider, and terminal filters compose", () => {
  const event = { title: "Coastal Cleanup", venue: "Gulf Place", sourceName: "City", startAt: "2026-08-01T13:00:00Z", endAt: "2026-08-01T15:00:00Z", beachId: "gulf-shores", status: "completed", archivedAt: "2026-08-01T15:00:00Z", sourceFacts: { providerId: "city" } };
  assert.equal(archiveMatchesFilters(event, { query: "cleanup", dateFrom: "2026-08-01", dateTo: "2026-08-01", beachId: "gulf-shores", providerId: "city", terminalStatus: "completed" }), true);
  assert.equal(archiveMatchesFilters(event, { query: "concert" }), false);
  assert.equal(archiveMatchesFilters(event, { dateFrom: "2026-08-02" }), false);
  assert.equal(archiveMatchesFilters(event, { beachId: "orange-beach" }), false);
  const legacy = { ...event, status: "expired", archivedAt: undefined };
  assert.equal(eventMatchesQueue(legacy, "archive"), true);
  assert.equal(archiveMatchesFilters(legacy, { query: "cleanup", terminalStatus: "expired" }), true);
  assert.equal(archiveMatchesFilters(legacy, { terminalStatus: "completed" }), false);
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
  assert.match(html, /Beach Activity Notifications/);
  assert.match(html, /Send test email/);
  assert.match(html, /Send review summary now/);
  assert.match(html, /Refresh event sources/);
  assert.match(html, /Beach coverage/);
  assert.match(html, /Changed after approval/);
  assert.match(html, /Ambiguous beach matches/);
  assert.match(html, /Possible duplicates/);
  assert.match(html, /Provider failures/);
  assert.match(html, /Published events needing attention/);
  assert.match(html, /Removed or cancelled/);
  assert.match(html, /Manual events/);
  assert.match(html, /Archive filters/);
  assert.match(html, /archive-from/);
  assert.match(html, /assignment-dialog/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /option value="approved">Approved, not public/);
  assert.match(html, /Approval and scheduling never publish an event/);
  assert.match(html, /At most one automatic actionable summary/);
  assert.match(html, /Refreshes and queue changes do not send review summaries automatically/);
  assert.match(html, /New manual events always begin in Pending Review/);
  assert.match(html, /Scheduled, not public — publish manually/);
  assert.match(html, /never publishes a scheduled record automatically/);
  assert.match(html, /form-beach-reference/);
  assert.match(js, /\/internal\/refresh\/beach-events/);
  assert.match(js, /\/admin\/beach-events\/notifications/);
  assert.match(js, /suppressedDuplicateCount/);
  assert.match(js, /Assignment creates a pending-review event\. It never publishes directly\./);
  assert.match(js, /No active provider coverage/);
  assert.match(js, /reasonDetail/);
  assert.match(js, /\["Public summary",event\.summary\]/);
  assert.match(js, /linkedDetail\("Source calendar URL",event\.sourceCalendarURL\|\|event\.sourceURL\)/);
  assert.match(js, /Original imported description/);
  assert.match(js, /sourceChangeSection/);
  assert.match(js, /auditSection/);
  assert.match(js, /Read-only archived record/);
  assert.match(js, /archiveMatchesFilters/);
  assert.match(js, /publishOption\.disabled/);
  assert.match(js, /status\.disabled=!event/);
  assert.match(js, /status\.value=event\?\.status\|\|"pendingReview"/);
  assert.match(js, /Create event for review/);
  assert.match(js, /Create for review/);
  assert.match(js, /"West End Beach"/);
  assert.doesNotMatch(js, /immediateChangeNotification/);
  assert.match(js, /Public revision changed/);
  assert.match(js, /event\.endTimeUnavailable/);
  assert.match(js, /updateBannerPreview/);
  assert.match(js, /control\.disabled=true/);
  assert.match(js, /Refresh status unavailable/);
  assert.match(js, /save\.textContent="Saving…"/);
  assert.match(js, /renderBeachReference/);
  assert.match(js, /secondary-actions/);
  assert.match(js, /model\.coverage\.filter\(item=>item\.activeEvents>0\)/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /max-width:600px/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  assert.match(css, /review-scroll/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /attention-row/);
  assert.match(css, /source-change table/);
});

test("event writes use per-record locks and conditional revisions", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../admin/events/events.js", import.meta.url), "utf8"));
  assert.match(source, /const eventMutations = new Set\(\)/);
  assert.match(source, /eventMutations\.has\(event\.id\)/);
  assert.match(source, /eventMutations\.add\(event\.id\)/);
  assert.match(source, /eventMutations\.delete\(event\.id\)/);
  assert.match(source, /"If-Match":event\.revision/);
  assert.match(source, /error\.status===412/);
  assert.match(source, /current event has been refreshed; review it before retrying/);
});
