import { API_BASE, TEMPLATES, expirationForPreset, localInputValue, payloadFromDraft, validateDraft, classifyFailure } from "./core.js?v=20260720-2";

const $ = (selector) => document.querySelector(selector);
const form = $("#announcement-form");
const fields = {
  id: $("#id"), title: $("#title"), message: $("#message"), severity: $("#severity"),
  startsAt: $("#starts-at"), expiresAt: $("#expires-at"), actionTitle: $("#action-title"), actionUrl: $("#action-url")
};
let currentAnnouncement = null;
let pendingPayload = null;
let busy = false;

function freshDefaults() {
  const now = new Date();
  fields.id.value = `notice-${now.toISOString().slice(0, 10)}`;
  fields.title.value = ""; fields.message.value = ""; fields.severity.value = "information";
  fields.startsAt.value = localInputValue(now);
  fields.expiresAt.value = localInputValue(new Date(now.getTime() + 60 * 60000));
  fields.actionTitle.value = ""; fields.actionUrl.value = "";
  $("input[name='start-mode'][value='now']").checked = true;
  $("#start-time-wrap").hidden = true;
  $("#template").value = "custom";
  clearErrors(); updatePreview(); updateCounters();
}

function draft() {
  return {
    id: fields.id.value, title: fields.title.value, message: fields.message.value, severity: fields.severity.value,
    startsAt: $("input[name='start-mode']:checked").value === "now" ? localInputValue(new Date()) : fields.startsAt.value,
    expiresAt: fields.expiresAt.value, actionTitle: fields.actionTitle.value, actionUrl: fields.actionUrl.value
  };
}

function clearErrors() {
  document.querySelectorAll("[data-error]").forEach((node) => { node.textContent = ""; });
  Object.values(fields).forEach((field) => field.removeAttribute("aria-invalid"));
}

function showErrors(errors) {
  clearErrors();
  for (const [key, message] of Object.entries(errors)) {
    const target = document.querySelector(`[data-error="${key}"]`);
    if (target) target.textContent = message;
    if (fields[key]) fields[key].setAttribute("aria-invalid", "true");
  }
  const first = Object.keys(errors).map((key) => fields[key]).find(Boolean);
  first?.focus();
}

function updateCounters() {
  $("[data-counter='title']").textContent = `${fields.title.value.length} / 80`;
  $("[data-counter='message']").textContent = `${fields.message.value.length} / 500`;
}

function updatePreview() {
  const severity = fields.severity.value;
  $("#preview").dataset.severity = severity;
  $("#preview-icon").textContent = { information: "ⓘ", notice: "●", important: "!", critical: "!" }[severity];
  $("#preview-title-text").textContent = fields.title.value.trim() || "Your title";
  $("#preview-message").textContent = fields.message.value.trim() || "Your message will appear here.";
  $("#preview-dismiss").hidden = severity === "critical";
  const action = $("#preview-action");
  action.textContent = fields.actionTitle.value.trim() || "Learn more";
  action.hidden = !fields.actionTitle.value.trim() || !fields.actionUrl.value.trim();
}

function notify(message, error = false) {
  const box = $("#alert"); box.textContent = message; box.hidden = false; box.classList.toggle("error", error);
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function appendDetail(list, label, value, className = "") {
  const dt = document.createElement("dt"); dt.textContent = label;
  const dd = document.createElement("dd"); dd.textContent = value; if (className) dd.className = className;
  list.append(dt, dd);
}

function renderStatus(announcement) {
  const container = $("#current-status"); container.replaceChildren();
  const badge = $("#status-badge");
  if (!announcement) {
    badge.textContent = "Inactive"; badge.className = "badge";
    const heading = document.createElement("h3"); heading.textContent = "No active announcement";
    const text = document.createElement("p"); text.className = "muted"; text.textContent = "Nothing is currently visible in the app.";
    container.append(heading, text); $("#status-actions").hidden = true; return;
  }
  badge.textContent = "Active"; badge.className = "badge active";
  const list = document.createElement("dl"); list.className = "status-list";
  appendDetail(list, "Severity", announcement.severity);
  appendDetail(list, "Title", announcement.title);
  appendDetail(list, "Message", announcement.message, "status-message");
  appendDetail(list, "Starts", formatDate(announcement.startsAt));
  appendDetail(list, "Expires", formatDate(announcement.expiresAt));
  appendDetail(list, "Revision", announcement.revision);
  if (announcement.actionTitle && announcement.actionUrl) appendDetail(list, "Action", `${announcement.actionTitle} — ${announcement.actionUrl}`);
  container.append(list); $("#status-actions").hidden = false;
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { credentials: "include", redirect: "follow", ...options });
  } catch (error) { throw new Error(classifyFailure({ network: true }), { cause: error }); }
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || response.redirected || !contentType.includes("application/json")) {
    let detail = "";
    if (contentType.includes("application/json")) {
      try { const body = await response.json(); detail = typeof body.message === "string" ? ` ${body.message}` : ""; } catch { /* readable fallback below */ }
    }
    throw new Error(`${classifyFailure({ status: response.status, redirected: response.redirected, contentType })}${detail}`);
  }
  return response.json();
}

async function refreshStatus({ announce = false } = {}) {
  $("#refresh").disabled = true;
  try {
    const body = await apiRequest("/v1/app-announcement", { cache: "no-store" });
    currentAnnouncement = body.announcement; renderStatus(currentAnnouncement);
    if (announce) notify("Current status refreshed.");
  } catch (error) { notify(error.message, true); $("#status-badge").textContent = "Unavailable"; }
  finally { $("#refresh").disabled = false; }
}

function setBusy(value, label = "Publishing…") {
  busy = value; $("#publish").disabled = value; $("#clear-current").disabled = value;
  $("#publish").textContent = value ? label : (currentAnnouncement ? "Publish replacement" : "Publish announcement");
}

async function publish() {
  if (busy || !pendingPayload) return;
  setBusy(true);
  try {
    const body = await apiRequest("/internal/app-announcement", { method: "PUT", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(pendingPayload) });
    currentAnnouncement = body.announcement; renderStatus(currentAnnouncement);
    notify(`Announcement published. Revision ${body.announcement.revision}. Allow a few minutes for public caches and KV propagation.`);
  } catch (error) { notify(error.message, true); }
  finally { pendingPayload = null; setBusy(false); }
}

form.addEventListener("submit", (event) => {
  event.preventDefault(); if (busy) return;
  const value = draft(); const errors = validateDraft(value);
  if (Object.keys(errors).length) { showErrors(errors); notify("Please correct the highlighted fields. Your draft has been preserved.", true); return; }
  clearErrors(); pendingPayload = payloadFromDraft(value);
  $("#confirm-title").textContent = currentAnnouncement ? "Replace the current announcement?" : "Publish this announcement?";
  const summary = $("#confirm-summary"); summary.replaceChildren();
  const title = document.createElement("p"); title.textContent = `${pendingPayload.severity.toUpperCase()} · ${pendingPayload.title}`;
  const times = document.createElement("div"); times.className = "confirm-times";
  const start = document.createElement("p"); start.textContent = `Starts: ${formatDate(pendingPayload.startsAt)}`;
  const end = document.createElement("p"); end.textContent = `Expires: ${formatDate(pendingPayload.expiresAt)}`;
  times.append(start, end); summary.append(title, times);
  $("#critical-warning").hidden = pendingPayload.severity !== "critical";
  $("#confirm-dialog").showModal();
});

$("#confirm-dialog").addEventListener("close", () => { if ($("#confirm-dialog").returnValue === "confirm") publish(); else pendingPayload = null; });
$("#clear-dialog").addEventListener("close", async () => {
  if ($("#clear-dialog").returnValue !== "confirm" || busy) return;
  setBusy(true, "Clearing…");
  try { await apiRequest("/internal/app-announcement", { method: "DELETE", headers: { "Accept": "application/json" } }); currentAnnouncement = null; renderStatus(null); notify("Announcement cleared. Allow a few minutes for public caches and KV propagation."); }
  catch (error) { notify(error.message, true); } finally { setBusy(false); }
});

$("#template").addEventListener("change", (event) => {
  const template = TEMPLATES[event.target.value];
  fields.title.value = template.title; fields.message.value = template.message; fields.severity.value = template.severity;
  fields.actionTitle.value = template.actionTitle || ""; fields.actionUrl.value = template.actionUrl || "";
  updatePreview(); updateCounters();
});
form.addEventListener("input", () => { updatePreview(); updateCounters(); });
form.addEventListener("change", updatePreview);
document.querySelectorAll("input[name='start-mode']").forEach((radio) => radio.addEventListener("change", () => { $("#start-time-wrap").hidden = radio.value !== "later" || !radio.checked; if (radio.checked && radio.value === "later") fields.startsAt.value = localInputValue(new Date(Date.now() + 15 * 60000)); }));
$("#expiration-presets").addEventListener("click", (event) => {
  const button = event.target.closest("button"); if (!button) return;
  document.querySelectorAll("#expiration-presets button").forEach((item) => item.classList.toggle("selected", item === button));
  if (button.dataset.preset === "custom") { fields.expiresAt.focus(); return; }
  const start = $("input[name='start-mode']:checked").value === "now" ? new Date() : new Date(fields.startsAt.value);
  const expires = expirationForPreset(button.dataset.preset, start);
  if (expires) fields.expiresAt.value = localInputValue(expires);
});
$("#edit-current").addEventListener("click", () => {
  if (!currentAnnouncement) return;
  for (const key of ["id", "title", "message", "severity", "actionTitle", "actionUrl"]) fields[key].value = currentAnnouncement[key] || "";
  fields.startsAt.value = localInputValue(new Date(currentAnnouncement.startsAt)); fields.expiresAt.value = localInputValue(new Date(currentAnnouncement.expiresAt));
  $("input[name='start-mode'][value='later']").checked = true; $("#start-time-wrap").hidden = false;
  updatePreview(); updateCounters(); $("#editor-title").scrollIntoView({ behavior: "smooth" });
});
$("#clear-current").addEventListener("click", () => $("#clear-dialog").showModal());
$("#refresh").addEventListener("click", () => refreshStatus({ announce: true }));
$("#reset").addEventListener("click", () => { if (confirm("Discard the current draft and reset the editor?")) freshDefaults(); });

freshDefaults();
refreshStatus();
