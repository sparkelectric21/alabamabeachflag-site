export const DASHBOARD_ENDPOINTS = Object.freeze({
  announcement: "/admin/service/admin/app-announcement",
  events: "/admin/service/admin/beach-events",
  providerHealth: "/admin/service/admin/provider-health",
  providerNotifications: "/admin/service/admin/provider-health/notifications",
  verification: "/admin/service/admin/verification",
  operationalControl: "/admin/service/admin/operational-control",
  publicConfiguration: "/admin/service/v1/app-configuration",
  historical: "/admin/service/admin/historical-data"
});

const object = (value, label) => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Malformed ${label} response.`); return value; };
const count = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function announcementSummary(payload) {
  object(payload, "announcement"); if (!Object.hasOwn(payload, "announcement") || typeof payload.status !== "string") throw new TypeError("Malformed announcement response."); const item = payload.announcement;
  if (item !== null && item !== undefined) object(item, "announcement");
  return { status: item ? payload.status || "stored" : "none", item: item || null };
}
export function eventsSummary(payload) {
  object(payload, "events"); if (!Array.isArray(payload.events)) throw new TypeError("Malformed events response.");
  const pending = payload.events.filter(item => item.status === "pendingReview").length;
  const attention = payload.events.filter(item => (item.attentionFlags || []).length || item.sourceChange).length;
  const failedProviders = (payload.refresh?.providers || []).filter(item => item.status === "failed").length;
  return { pending, attention, failedProviders, refreshStatus: payload.refresh?.status || "unavailable" };
}
export function providerSummary(payload) {
  object(payload, "provider health"); object(payload.overall, "provider health");
  return { status: payload.overall.status || "unknown", incidents: count(payload.overall.activeIncidentCount) };
}
export function notificationSummary(payload) {
  object(payload, "provider notifications"); const state = payload.state || {};
  return { bindingReady: Boolean(payload.bindingReady), enabled: Boolean(payload.configuration?.enabled), lastSuccessAt: state.lastSuccessAt || null, lastFailureAt: state.lastFailureAt || null, lastProviderError: state.lastProviderError || null };
}
export function verificationSummary(payload) {
  object(payload, "verification"); const verifiers = Array.isArray(payload.verifiers) ? payload.verifiers : [];
  const statuses = verifiers.length ? verifiers.map(item => item.latest?.status || "unavailable") : [payload.summary?.overallStatus || "unavailable"];
  return { failing: statuses.filter(value => value === "fail").length, warning: statuses.filter(value => value === "warning").length, unavailable: statuses.filter(value => !["pass", "warning", "fail"].includes(value)).length, lastAt: payload.summary?.lastVerificationAt || payload.latest?.completedAt || null };
}
export function controlSummary(payload, publicPayload = null, now = new Date()) {
  object(payload, "operational control"); const configuration = object(payload.configuration, "operational control"); const controls = object(configuration.controls, "operational control");
  let restricted = 0, reviewRequired = 0;
  for (const value of Object.values(controls)) { if (value?.state !== "enabled") restricted++; if (value?.state !== "enabled" && value?.onExpiry === "require_review" && value.expiresAt && new Date(value.expiresAt) <= now) reviewRequired++; }
  return { restricted, reviewRequired, revisionsAgree: publicPayload?.controlRevision ? publicPayload.controlRevision === configuration.revision : null };
}
export function historicalSummary(payload) {
  object(payload, "historical data"); const jobs = Array.isArray(payload.jobHealth) ? payload.jobHealth : [];
  const failingJobs = jobs.filter(item => ["late", "never_succeeded"].includes(item.status)).length;
  const rejected = (payload.last24Hours || []).reduce((total, row) => total + count(row.rejected), 0);
  const lastSuccessAt = jobs.map(item => item.last_success_at).filter(Boolean).sort().at(-1) || null;
  return { configured: payload.configured !== false, jobCount: jobs.length, failingJobs, rejected, recentFailures: Array.isArray(payload.recentFailures) ? payload.recentFailures.length : 0, lastSuccessAt };
}

export function dashboardActions(state) {
  const actions = [];
  if (state.events?.pending) actions.push({ level: "action", area: "Events", text: `${state.events.pending} event item${state.events.pending === 1 ? "" : "s"} awaiting review.`, href: "events/" });
  if (state.events?.failedProviders) actions.push({ level: "action", area: "Events", text: `${state.events.failedProviders} event provider refresh failure${state.events.failedProviders === 1 ? "" : "s"}.`, href: "events/" });
  else if (state.events?.refreshStatus === "failed") actions.push({ level: "action", area: "Events", text: "The latest event provider refresh failed.", href: "events/" });
  else if (state.events && !["healthy", "ok"].includes(state.events.refreshStatus)) actions.push({ level: "attention", area: "Events", text: `Event provider refresh state is ${state.events.refreshStatus}.`, href: "events/" });
  if (state.events?.attention) actions.push({ level: "attention", area: "Events", text: `${state.events.attention} event item${state.events.attention === 1 ? "" : "s"} with attention or source changes.`, href: "events/" });
  if (state.provider?.incidents) actions.push({ level: "action", area: "Provider Health", text: `${state.provider.incidents} active provider incident${state.provider.incidents === 1 ? "" : "s"}.`, href: "provider-health/" });
  else if (state.provider && state.provider.status !== "healthy") actions.push({ level: "attention", area: "Provider Health", text: `Overall provider state is ${state.provider.status}.`, href: "provider-health/" });
  if (state.notifications?.lastFailureAt && (!state.notifications.lastSuccessAt || state.notifications.lastFailureAt > state.notifications.lastSuccessAt)) actions.push({ level: "attention", area: "Provider Health", text: "The latest provider notification delivery failed.", href: "provider-health/" });
  if (state.verification?.failing || state.verification?.unavailable) actions.push({ level: "action", area: "Verification", text: `${state.verification.failing + state.verification.unavailable} verifier${state.verification.failing + state.verification.unavailable === 1 ? "" : "s"} failing or unavailable.`, href: "verification/" });
  else if (state.verification?.warning) actions.push({ level: "attention", area: "Verification", text: `${state.verification.warning} verifier warning${state.verification.warning === 1 ? "" : "s"}.`, href: "verification/" });
  if (state.control?.restricted) actions.push({ level: state.control.reviewRequired ? "action" : "attention", area: "Operational Control", text: `${state.control.restricted} operational control${state.control.restricted === 1 ? " is" : "s are"} restricted${state.control.reviewRequired ? `; ${state.control.reviewRequired} require review` : ""}.`, href: "operational-control/" });
  if (state.historical?.failingJobs || state.historical?.recentFailures) actions.push({ level: "action", area: "Historical Data", text: `${state.historical.failingJobs} unhealthy ingestion job${state.historical.failingJobs === 1 ? "" : "s"}; ${state.historical.recentFailures} recent failure${state.historical.recentFailures === 1 ? "" : "s"}.`, href: "historical-data/" });
  else if (state.historical?.configured && state.historical.jobCount === 0) actions.push({ level: "attention", area: "Historical Data", text: "No ingestion job health records were returned.", href: "historical-data/" });
  if (state.historical?.rejected) actions.push({ level: "attention", area: "Historical Data", text: `${state.historical.rejected} rejected row${state.historical.rejected === 1 ? "" : "s"} in the last 24 hours.`, href: "historical-data/" });
  return actions;
}
