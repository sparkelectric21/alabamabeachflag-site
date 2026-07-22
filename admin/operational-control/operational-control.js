import { CONTROL_ENDPOINT, IMPACT, auditRecordFields, auditUrl, canApplyTransition, classifyAuditFailure, classifyControlFailure, criticalConfirmationPhrase, expiryForPreset, parseAuditPage, validateTransition } from "./core.js";

const $ = (selector) => document.querySelector(selector);
const label = (value) => String(value).replaceAll(".", " › ").replaceAll(/([A-Z])/g, " $1");
let current = null;
let auditCursor = null;
let auditLoading = false;
const auditIds = new Set();

function show(message, error = false) { const node = $("#alert"); node.textContent = message; node.classList.toggle("error", error); node.hidden = false; }
function render(payload) {
  current = payload.configuration;
  $("#revision").textContent = `Revision ${current.revision}`;
  const controls = $("#controls"); controls.replaceChildren();
  for (const [id, value] of Object.entries(current.controls)) {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = label(id); dd.textContent = `${value.state}${value.expiresAt ? ` · expires ${new Date(value.expiresAt).toLocaleString()}` : ""}`; controls.append(dt, dd);
  }
  $("#propagation").textContent = "Public revision confirmation pending after any change.";
}
function auditIdentity(record, index) { return String(record.auditId ?? `${record.timestamp ?? "unknown"}:${record.resultingRevision ?? "unknown"}:${index}`); }
function renderAuditRecord(record) {
  const article = document.createElement("article"), heading = document.createElement("h3"), fields = document.createElement("dl");
  article.className = "audit-record"; fields.className = "status-list";
  const displayFields = auditRecordFields(record), action = displayFields.find(([name]) => name === "Action")?.[1] ?? "Change";
  heading.textContent = `${action}${record.controlId ? ` · ${label(record.controlId)}` : ""}`;
  for (const [name, rawValue] of displayFields) {
    const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = name;
    if (name === "Changed" && !Number.isNaN(Date.parse(rawValue))) { const time = document.createElement("time"); time.dateTime = rawValue; time.textContent = new Date(rawValue).toLocaleString(); dd.append(time); }
    else dd.textContent = typeof rawValue === "boolean" ? (rawValue ? "Yes" : "No") : String(rawValue);
    fields.append(dt, dd);
  }
  article.append(heading, fields); return article;
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
    auditCursor = page.cursor; records.hidden = auditIds.size === 0;
    if (auditIds.size === 0) setAuditStatus("No operational-control changes have been recorded."); else $("#audit-status").hidden = true;
    $("#load-more-audit").hidden = !auditCursor;
  } catch (error) { setAuditStatus(error instanceof Error ? error.message : "Audit history could not be loaded.", true); $("#load-more-audit").hidden = true; }
  finally { auditLoading = false; $("#refresh-audit").disabled = false; $("#load-more-audit").disabled = false; }
}

$("#control").addEventListener("change", () => { $("#impact").textContent = IMPACT[$("#control").value]; });
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
