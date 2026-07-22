import { CONTROL_ENDPOINT, IMPACT, auditRecordFields, auditUrl, canApplyTransition, classifyAuditFailure, classifyControlFailure, criticalConfirmationPhrase, expiryForPreset, parseAuditPage, validateTransition } from "./core.js";

const $ = (selector) => document.querySelector(selector);
const label = (value) => String(value).replaceAll(".", " › ").replaceAll(/([A-Z])/g, " $1");
const CONTROL_DETAILS = {
  "global.liveData": { name: "Global live data", description: "Master control for all live beach-flag data.", glyph: "◎", scope: "All live flag providers and beaches", providers: "Gulf Shores and Orange Beach", beaches: "All official locations", inherited: "Includes Fort Morgan through Gulf Shores" },
  "domains.beachFlags": { name: "Beach flags domain", description: "Controls the public beach-flag data domain.", glyph: "◇", scope: "All beach-flag locations", providers: "Gulf Shores and Orange Beach", beaches: "All official locations", inherited: "Includes Fort Morgan through Gulf Shores" },
  "providers.gulfShoresFlags": { name: "Gulf Shores flags", description: "Provider control for Gulf Shores and its inherited scope.", glyph: "≈", scope: "Gulf Shores provider", providers: "Gulf Shores", beaches: "Gulf Shores locations", inherited: "Fort Morgan is included" },
  "providers.orangeBeachFlags": { name: "Orange Beach flags", description: "Independent provider control for Orange Beach locations.", glyph: "≈", scope: "Orange Beach provider", providers: "Orange Beach", beaches: "Orange Beach locations only", inherited: "None — independent control" }
};
const stateLabel = (state) => ({ enabled: "Enabled", monitorOnly: "Monitor only", disabled: "Disabled" })[state] ?? label(state);
const stateClass = (state) => ({ enabled: "enabled", monitorOnly: "monitor-only", disabled: "disabled" })[state] ?? "unknown";
let current = null;
let auditCursor = null;
let auditLoading = false;
const auditIds = new Set();

function show(message, error = false) { const node = $("#alert"); node.textContent = message; node.classList.toggle("error", error); node.hidden = false; }
function render(payload) {
  current = payload.configuration;
  $("#revision").textContent = `Revision ${current.revision}`;
  $("#summary-revision").textContent = current.revision;
  const controls = $("#controls"); controls.replaceChildren();
  let restrictions = 0;
  for (const [id, value] of Object.entries(current.controls)) {
    if (value.state !== "enabled") restrictions += 1;
    const detail = CONTROL_DETAILS[id] ?? { name: label(id), description: "Operational control.", glyph: "•" };
    const row = document.createElement("article"); row.className = "control-row";
    const identity = document.createElement("div"), title = document.createElement("div"), glyph = document.createElement("span"), name = document.createElement("span"), description = document.createElement("p"), rawId = document.createElement("code");
    title.className = "control-title"; glyph.className = "control-glyph"; glyph.setAttribute("aria-hidden", "true"); glyph.textContent = detail.glyph; name.textContent = detail.name;
    description.className = "control-description"; description.textContent = detail.description; rawId.className = "control-id"; rawId.textContent = id; title.append(glyph, name); identity.append(title, description, rawId);
    const state = document.createElement("div"), badge = document.createElement("span"); state.className = "control-state"; badge.className = `state-badge state-${stateClass(value.state)}`; badge.textContent = stateLabel(value.state); state.append(badge);
    if (value.expiresAt) { const expiry = document.createElement("span"); expiry.className = "state-expiry"; expiry.textContent = `Expires ${new Date(value.expiresAt).toLocaleString()}`; state.append(expiry); }
    row.append(identity, state); controls.append(row);
  }
  const normal = restrictions === 0;
  $(".summary").classList.toggle("restricted", !normal); $(".summary-icon").textContent = normal ? "✓" : "!";
  $("#summary-status").textContent = normal ? "Operational controls normal" : `${restrictions} active ${restrictions === 1 ? "restriction" : "restrictions"}`;
  $("#summary-detail").textContent = normal ? "All controls enabled; provider health is reported separately." : "One or more controls are not enabled.";
  $("#summary-restrictions").textContent = String(restrictions);
  $("#propagation").textContent = "Public revision confirmation pending after any change.";
}
function auditIdentity(record, index) { return String(record.auditId ?? `${record.timestamp ?? "unknown"}:${record.resultingRevision ?? "unknown"}:${index}`); }
function renderAuditRecord(record) {
  const article = document.createElement("article"), heading = document.createElement("h3"), fields = document.createElement("dl");
  article.className = "audit-record"; fields.className = "status-list";
  const displayFields = auditRecordFields(record), action = displayFields.find(([name]) => name === "Action")?.[1] ?? "Change";
  heading.textContent = `${action}${record.controlId ? ` · ${label(record.controlId)}` : ""}`;
  const actionBadge = document.createElement("span"); actionBadge.className = `state-badge audit-action state-${stateClass(record.nextState)}`; actionBadge.textContent = action;
  for (const [name, rawValue] of displayFields) {
    const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = name;
    if (name === "Changed" && !Number.isNaN(Date.parse(rawValue))) { const time = document.createElement("time"); time.dateTime = rawValue; time.textContent = new Date(rawValue).toLocaleString(); dd.append(time); }
    else dd.textContent = typeof rawValue === "boolean" ? (rawValue ? "Yes" : "No") : String(rawValue);
    fields.append(dt, dd);
  }
  article.append(heading, actionBadge, fields); return article;
}
function setAuditStatus(message, error = false) { const status = $("#audit-status"); status.textContent = message; status.classList.toggle("error", error); status.hidden = false; }
async function refresh() {
  const response = await fetch(CONTROL_ENDPOINT, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok || response.redirected) throw new Error(classifyControlFailure(response));
  render(await response.json());
}
async function loadAudit({ append = false } = {}) {
  if (auditLoading) return;
  auditLoading = true; $("#refresh-audit").disabled = true; $("#load-more-audit").disabled = true;
  if (!append) { auditCursor = null; auditIds.clear(); $("#audit-records").replaceChildren(); setAuditStatus("Loading audit history…"); }
  else setAuditStatus("Loading more audit history…");
  try {
    const response = await fetch(auditUrl(append ? auditCursor : null), { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok || response.redirected) throw new Error(classifyAuditFailure(response));
    let page; try { page = parseAuditPage(await response.json()); } catch { throw new TypeError("The audit service returned a malformed response. History was not displayed."); }
    const records = $("#audit-records");
    page.records.forEach((record, index) => { const id = auditIdentity(record, index); if (!auditIds.has(id)) { auditIds.add(id); records.append(renderAuditRecord(record)); } });
    auditCursor = page.cursor; records.hidden = auditIds.size === 0; $("#summary-audit").textContent = String(auditIds.size);
    const latest = page.records.find((record) => record.timestamp && !Number.isNaN(Date.parse(record.timestamp)));
    if (!append) $("#summary-last-change").textContent = latest ? new Date(latest.timestamp).toLocaleString() : "None recorded";
    if (auditIds.size === 0) setAuditStatus("No operational-control changes have been recorded."); else $("#audit-status").hidden = true;
    $("#load-more-audit").hidden = !auditCursor;
  } catch (error) { setAuditStatus(error instanceof Error ? error.message : "Audit history could not be loaded.", true); $("#load-more-audit").hidden = true; }
  finally { auditLoading = false; $("#refresh-audit").disabled = false; $("#load-more-audit").disabled = false; }
}

function renderImpact() {
  const id = $("#control").value, detail = CONTROL_DETAILS[id];
  const rows = [["Scope", detail.scope], ["Affected providers", detail.providers], ["Affected beaches", detail.beaches], ["Inherited effects", detail.inherited], ["Public impact", IMPACT[id]]];
  const heading = document.createElement("strong"), list = document.createElement("dl"); heading.textContent = "Impact preview"; list.className = "impact-grid";
  for (const [name, value] of rows) { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = name; dd.textContent = value; list.append(dt, dd); }
  $("#impact").replaceChildren(heading, list);
}
$("#control").addEventListener("change", renderImpact);
$("#control").dispatchEvent(new Event("change"));
$("#refresh").addEventListener("click", () => Promise.allSettled([refresh(), loadAudit()]).then((results) => { if (results[0].status === "rejected") show(results[0].reason.message, true); }));
$("#refresh-audit").addEventListener("click", () => loadAudit());
$("#load-more-audit").addEventListener("click", () => { if (auditCursor) loadAudit({ append: true }); });

$("#control-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const state = $("#state").value;
  const draft = { controlId: $("#control").value, state, reasonCode: $("#reason-code").value, operatorReason: $("#operator-reason").value, expiresAt: state === "enabled" ? undefined : expiryForPreset($("#duration").value), onExpiry: $("#expiry-behavior").value };
  const errors = validateTransition(draft); if (Object.keys(errors).length) return show(Object.values(errors).join(" "), true);
  if (!current?.revision) return show("Current revision is unavailable. Refresh before retrying.", true);
  const reviewRevision = current.revision;
  const requiredPhrase = criticalConfirmationPhrase(draft.controlId, draft.state);
  $("#confirm-copy").textContent = `${draft.controlId} will become ${draft.state}. Impact: ${IMPACT[draft.controlId]}.${requiredPhrase ? " This is a critical broad-scope disable." : ""}`;
  $("#typed-confirmation").hidden = !requiredPhrase; $("#required-phrase").textContent = requiredPhrase ?? ""; $("#confirmation-phrase").value = "";
  const updateApply = () => {
    const ready = canApplyTransition({ draft, revision: current?.revision === reviewRevision ? reviewRevision : null, requiredPhrase, confirmation: $("#confirmation-phrase").value });
    $("#apply-confirm").disabled = !ready; $("#confirmation-error").hidden = !requiredPhrase || ready; $("#confirmation-phrase").setAttribute("aria-invalid", String(Boolean(requiredPhrase && !ready)));
  };
  updateApply(); $("#confirmation-phrase").addEventListener("input", updateApply); $("#confirm").returnValue = ""; $("#confirm").showModal(); (requiredPhrase ? $("#confirmation-phrase") : $("#apply-confirm")).focus();
  const confirmed = await new Promise((resolve) => $("#confirm").addEventListener("close", () => resolve($("#confirm").returnValue === "confirm"), { once: true }));
  $("#confirmation-phrase").removeEventListener("input", updateApply);
  if (!confirmed) return;
  if (!canApplyTransition({ draft, revision: current?.revision === reviewRevision ? reviewRevision : null, requiredPhrase, confirmation: $("#confirmation-phrase").value })) return show("Confirmation requirements are no longer satisfied. No change was sent.", true);
  const response = await fetch(CONTROL_ENDPOINT, { method: "PATCH", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json", "If-Match": reviewRevision }, body: JSON.stringify(draft) });
  if (!response.ok || response.redirected) return show(classifyControlFailure(response), true);
  render(await response.json()); show("Control changed. Verify the public revision before declaring propagation complete."); await loadAudit();
});

Promise.allSettled([refresh(), loadAudit()]).then((results) => { if (results[0].status === "rejected") show(results[0].reason.message, true); });
