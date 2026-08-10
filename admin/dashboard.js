import { DASHBOARD_ENDPOINTS, announcementSummary, controlSummary, dashboardActions, eventsSummary, historicalSummary, notificationSummary, providerSummary, verificationSummary } from "./dashboard-core.js";
import { formatCentralTime, requestJson, setNotice } from "./shared.js";

const $ = selector => document.querySelector(selector);
const state = {}, errors = {};
let refreshing = false;
const sources = {
  announcement: async () => announcementSummary(await requestJson(DASHBOARD_ENDPOINTS.announcement)),
  events: async () => eventsSummary(await requestJson(DASHBOARD_ENDPOINTS.events)),
  provider: async () => providerSummary(await requestJson(DASHBOARD_ENDPOINTS.providerHealth)),
  notifications: async () => notificationSummary(await requestJson(DASHBOARD_ENDPOINTS.providerNotifications)),
  verification: async () => verificationSummary(await requestJson(DASHBOARD_ENDPOINTS.verification)),
  control: async () => { const protectedPayload = await requestJson(DASHBOARD_ENDPOINTS.operationalControl); let publicPayload = null; try { publicPayload = await requestJson(DASHBOARD_ENDPOINTS.publicConfiguration); } catch {} return controlSummary(protectedPayload, publicPayload); },
  historical: async () => { try { return historicalSummary(await requestJson(DASHBOARD_ENDPOINTS.historical)); } catch (error) { if (error.status === 503 && error.payload?.status === "not_configured") return { configured: false, jobCount: 0, failingJobs: 0, rejected: 0, recentFailures: 0, lastSuccessAt: null }; throw error; } }
};
const cardInfo = {
  announcement: ["Announcements", "announcements/"], events: ["Events", "events/"], provider: ["Provider Health", "provider-health/"], verification: ["Verification", "verification/"], control: ["Operational Control", "operational-control/"], historical: ["Historical Data", "historical-data/"]
};
const detail = (label, value) => { const row = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; row.append(dt, dd); return row; };
const statusLabel = value => String(value || "unknown").replaceAll(/([A-Z])/g, " $1").replace(/^./, letter => letter.toUpperCase());

function cardRows(key) {
  const value = state[key];
  if (key === "announcement") return value.item ? [["Stored state", statusLabel(value.status)], ["Audience", value.item.scope === "beaches" ? `${value.item.beachIds?.length || 0} selected beaches` : "All Beaches"], ["Starts", formatCentralTime(value.item.startsAt)], ["Expires", formatCentralTime(value.item.expiresAt)]] : [["Stored state", "None"]];
  if (key === "events") return [["Awaiting review", String(value.pending)], ["Attention / source changes", String(value.attention)], ["Provider failures", String(value.failedProviders)], ["Latest refresh", statusLabel(value.refreshStatus)]];
  if (key === "provider") { const notification = state.notifications; return [["Overall", statusLabel(value.status)], ["Active incidents", String(value.incidents)], ["Latest notification", errors.notifications ? "Unavailable" : notification?.lastFailureAt && (!notification.lastSuccessAt || notification.lastFailureAt > notification.lastSuccessAt) ? `Failed ${formatCentralTime(notification.lastFailureAt)}` : notification?.lastSuccessAt ? `Succeeded ${formatCentralTime(notification.lastSuccessAt)}` : "No delivery recorded"]]; }
  if (key === "verification") return [["Failing", String(value.failing)], ["Warnings", String(value.warning)], ["Unavailable", String(value.unavailable)], ["Latest verification", formatCentralTime(value.lastAt)]];
  if (key === "control") return [["Restricted controls", String(value.restricted)], ["Review required", String(value.reviewRequired)], ["Public revision", value.revisionsAgree === null ? "Unverified" : value.revisionsAgree ? "Confirmed" : "Pending"]];
  return value.configured ? [["Unhealthy jobs", String(value.failingJobs)], ["Recent failures", String(value.recentFailures)], ["Rejected rows · 24h", String(value.rejected)], ["Latest job success", formatCentralTime(value.lastSuccessAt)]] : [["Configuration", "Historical storage is not configured in this environment"]];
}
function renderCard(key) {
  const card = $(`[data-card="${key}"]`), body = card.querySelector("dl"), badge = card.querySelector(".dashboard-badge");
  if (!state[key]) { badge.textContent = "Unavailable"; badge.dataset.level = "unavailable"; body.replaceChildren(detail("Status", errors[key]?.message || "No data returned.")); return; }
  const actions = dashboardActions(state).filter(item => item.href === cardInfo[key][1]);
  if (key === "historical" && !state.historical.configured) { badge.textContent = "Unavailable"; badge.dataset.level = "unavailable"; body.replaceChildren(...cardRows(key).map(([label, value]) => detail(label, value))); return; }
  if ((key === "provider" && errors.notifications) || (key === "control" && state.control.revisionsAgree === null)) { badge.textContent = "Unavailable"; badge.dataset.level = "unavailable"; body.replaceChildren(...cardRows(key).map(([label, value]) => detail(label, value))); return; }
  badge.textContent = actions.some(item => item.level === "action") ? "Action required" : actions.length ? "Attention" : "Normal";
  badge.dataset.level = actions.some(item => item.level === "action") ? "action" : actions.length ? "attention" : "normal";
  body.replaceChildren(...cardRows(key).map(([label, value]) => detail(label, value)));
}
function render() {
  for (const key of Object.keys(cardInfo)) renderCard(key);
  const root = $("#action-items"), actions = dashboardActions(state); root.replaceChildren();
  if (!actions.length) { const empty = document.createElement("p"); empty.className = "dashboard-empty"; empty.textContent = Object.keys(errors).length ? "No action items could be confirmed from the available sources." : "No current action items were reported."; root.append(empty); }
  for (const item of actions) { const row = document.createElement("article"), text = document.createElement("div"), label = document.createElement("span"), message = document.createElement("p"), link = document.createElement("a"); row.className = "action-item"; row.dataset.level = item.level; label.textContent = item.level === "action" ? "Action required" : "Attention"; message.textContent = item.text; text.append(label, message); link.href = item.href; link.textContent = `Open ${item.area}`; row.append(text, link); root.append(row); }
}
async function refresh() {
  if (refreshing) return false; refreshing = true; const button = $("#refresh"); button.disabled = true; button.textContent = "Refreshing…"; setNotice($("#dashboard-notice"), "Refreshing operational sources.");
  const entries = Object.entries(sources), results = await Promise.allSettled(entries.map(([, load]) => load()));
  results.forEach((result, index) => { const key = entries[index][0]; if (result.status === "fulfilled") { state[key] = result.value; delete errors[key]; } else errors[key] = result.reason; });
  render(); const failed = results.filter(result => result.status === "rejected").length; const access = Object.values(errors).some(error => error?.kind === "access");
  $("#last-refreshed").textContent = `Last refreshed ${formatCentralTime(new Date())}`;
  setNotice($("#dashboard-notice"), access ? "One or more sources require Access re-authentication. Loaded cards remain visible." : failed ? `${entries.length - failed} of ${entries.length} dashboard sources refreshed. Unavailable cards retain their last loaded state where possible.` : "All dashboard sources refreshed.", { kind: access ? "error" : "status" });
  refreshing = false; button.disabled = false; button.textContent = "Refresh"; return failed === 0;
}

$("#refresh").addEventListener("click", refresh);
refresh();
