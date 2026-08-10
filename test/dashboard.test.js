import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DASHBOARD_ENDPOINTS, announcementSummary, controlSummary, dashboardActions, eventsSummary, historicalSummary, providerSummary, verificationSummary } from "../admin/dashboard-core.js";
import { AdminRequestError } from "../admin/shared.js";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard uses only existing protected read contracts", () => {
  assert.deepEqual(Object.values(DASHBOARD_ENDPOINTS), [
    "/admin/service/admin/app-announcement", "/admin/service/admin/beach-events", "/admin/service/admin/provider-health", "/admin/service/admin/provider-health/notifications", "/admin/service/admin/verification", "/admin/service/admin/operational-control", "/admin/service/v1/app-configuration", "/admin/service/admin/historical-data"
  ]);
});
test("healthy source summaries produce no action items", () => {
  const state = {
    events: eventsSummary({ events: [], refresh: { status: "healthy", providers: [] } }),
    provider: providerSummary({ overall: { status: "healthy", activeIncidentCount: 0 } }),
    verification: verificationSummary({ summary: { overallStatus: "pass", lastVerificationAt: "2026-08-10T12:00:00Z" } }),
    control: controlSummary({ configuration: { revision: "r1", controls: { global: { state: "enabled" } } } }, { controlRevision: "r1" }),
    historical: historicalSummary({ configured: true, jobHealth: [{ status: "healthy", last_success_at: "2026-08-10T12:00:00Z" }], last24Hours: [], recentFailures: [] })
  };
  assert.deepEqual(dashboardActions(state), []);
});
test("explicit source exceptions become restrained action and attention items", () => {
  const actions = dashboardActions({ events: { pending: 2, attention: 1, failedProviders: 1 }, provider: { status: "critical", incidents: 1 }, notifications: { lastFailureAt: "2026-08-10T13:00:00Z", lastSuccessAt: "2026-08-10T12:00:00Z" }, verification: { failing: 1, warning: 0, unavailable: 1 }, control: { restricted: 2, reviewRequired: 1 }, historical: { failingJobs: 1, recentFailures: 2, rejected: 3 } });
  assert.ok(actions.some(item => item.level === "action" && item.href === "events/"));
  assert.ok(actions.some(item => item.level === "attention" && item.href === "provider-health/"));
  assert.ok(actions.some(item => item.href === "operational-control/"));
  assert.ok(actions.some(item => item.href === "historical-data/"));
});
test("dashboard refresh is locked, partial, read-only, and preserves card state", () => {
  const source = read("admin/dashboard.js"), html = read("admin/index.html");
  assert.match(source, /if \(refreshing\) return false/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /state\[key\] = result\.value/);
  assert.match(source, /error\?\.kind === "access"/);
  assert.match(source, /formatCentralTime\(new Date\(\)\)/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(html, /Publish announcement|Approve|Disable|type="submit"/);
  for (const href of ["announcements/", "events/", "provider-health/", "verification/", "operational-control/", "historical-data/"]) assert.match(html, new RegExp(`href="${href}"`));
});
test("malformed summaries fail closed instead of reporting healthy", () => {
  assert.throws(() => announcementSummary({}), /Malformed/);
  assert.throws(() => eventsSummary({ events: null }), /Malformed/);
  assert.throws(() => providerSummary({}), /Malformed/);
  assert.throws(() => controlSummary({ configuration: {} }), /Malformed/);
  assert.equal(new AdminRequestError("Access", { kind: "access" }).kind, "access");
});
test("failed supporting reads and explicit unavailable states cannot become Normal", () => {
  assert.ok(dashboardActions({ events: { pending: 0, attention: 0, failedProviders: 0, refreshStatus: "failed" } }).some(item => item.level === "action"));
  assert.ok(dashboardActions({ events: { pending: 0, attention: 0, failedProviders: 0, refreshStatus: "unavailable" } }).some(item => item.level === "attention"));
  assert.ok(dashboardActions({ historical: { configured: true, jobCount: 0, failingJobs: 0, recentFailures: 0, rejected: 0 } }).some(item => item.level === "attention"));
  const source = read("admin/dashboard.js");
  assert.match(source, /key === "provider" && errors\.notifications/);
  assert.match(source, /key === "control" && state\.control\.revisionsAgree === null/);
});
test("announcement manager moved intact and dashboard has no editor", () => {
  const dashboard = read("admin/index.html"), announcements = read("admin/announcements/index.html"), source = read("admin/admin.js");
  assert.doesNotMatch(dashboard, /announcement-form|confirm-dialog|clear-dialog/);
  for (const id of ["announcement-form", "audience-fieldset", "confirm-dialog", "clear-dialog"]) assert.match(announcements, new RegExp(`id="${id}"`));
  assert.match(announcements, /src="\.\.\/admin\.js/);
  assert.match(source, /"If-Match": currentAnnouncement\.revision/);
  assert.equal(announcementSummary({ status: "scheduled", announcement: { startsAt: "2026-08-11T12:00:00Z" } }).status, "scheduled");
});
test("dashboard layout has responsive breakpoints without fixed overflow", () => {
  const css = read("admin/dashboard.css");
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.doesNotMatch(css, /min-width:\s*[4-9]\d\dpx/);
});
