export const CONTROL_ENDPOINT = "/admin/service/admin/operational-control";
export const AUDIT_ENDPOINT = `${CONTROL_ENDPOINT}/audit`;
export const PUBLIC_CONFIGURATION_ENDPOINT = "/admin/service/v1/app-configuration";

export const IMPACT = {
  "global.liveData": "All live flag providers and beaches",
  "domains.beachFlags": "All beach-flag locations",
  "domains.beachEvents": "Beach Activity & Event Impact only",
  "domains.vibrioAwareness": "Seasonal Vibrio awareness only; flags, water quality, weather, and ordinary water temperature remain available",
  "notifications.beachActivity": "Beach Activity review email delivery only",
  "providers.gulfShoresFlags": "Gulf Shores locations and inherited Fort Morgan",
  "providers.orangeBeachFlags": "Orange Beach locations only",
  "providers.gulfShoresEvents": "City of Gulf Shores event discovery only",
  "providers.orangeBeachEvents": "City of Orange Beach event discovery only"
};

export function expiryForPreset(preset, now = new Date()) {
  const minutes = { "30m": 30, "1h": 60, "6h": 360 }[preset];
  return minutes ? new Date(now.getTime() + minutes * 60_000).toISOString() : null;
}

export function summarizeControls(controls, now = new Date()) {
  const values = Object.values(controls ?? {});
  const monitorOnly = values.filter((value) => value?.state === "monitorOnly" && (!value.expiresAt || new Date(value.expiresAt) > now)).length;
  const expiredReview = values.filter((value) => value?.state !== "enabled" && value?.onExpiry === "require_review" && value.expiresAt && new Date(value.expiresAt) <= now).length;
  const disabled = values.filter((value) => value?.state === "disabled" || (value?.state !== "enabled" && value?.onExpiry === "require_review" && value.expiresAt && new Date(value.expiresAt) <= now)).length;
  return { total: values.length, monitorOnly, disabled, expiredReview, notEnabled: monitorOnly + disabled };
}

export function publicRevisionStatus(protectedRevision, publicRevision) {
  if (!publicRevision) return { label: "Public revision pending", confirmed: false };
  return protectedRevision === publicRevision ? { label: "Public revision confirmed", confirmed: true } : { label: "Public revision pending", confirmed: false };
}

export function validateTransition(draft, now = new Date()) {
  const errors = {};
  if (!Object.hasOwn(IMPACT, draft.controlId)) errors.controlId = "Choose a supported control.";
  if (!["enabled", "disabled", "monitorOnly"].includes(draft.state)) errors.state = "Choose a supported state.";
  if (!draft.reasonCode) errors.reasonCode = "Choose a reason.";
  if (!draft.operatorReason?.trim()) errors.operatorReason = "Enter an operator reason.";
  if (draft.state !== "enabled") {
    const expires = new Date(draft.expiresAt);
    if (Number.isNaN(expires.valueOf()) || expires <= now) errors.expiresAt = "Choose a future expiration.";
  }
  return errors;
}

export function requiresCriticalConfirmation(controlId, state) {
  return state === "disabled" && ["global.liveData", "domains.beachFlags", "domains.beachEvents", "domains.vibrioAwareness"].includes(controlId);
}

export function criticalConfirmationPhrase(controlId, state) {
  if (state !== "disabled") return null;
  if (controlId === "global.liveData") return "DISABLE LIVE DATA";
  if (controlId === "domains.beachFlags") return "DISABLE BEACH FLAGS";
  if (controlId === "domains.beachEvents") return "DISABLE BEACH EVENTS";
  if (controlId === "domains.vibrioAwareness") return "DISABLE VIBRIO AWARENESS";
  return null;
}

export function confirmationMatches(requiredPhrase, input) {
  return requiredPhrase === null || String(input ?? "").trim() === requiredPhrase;
}

export function canApplyTransition({ draft, revision, requiredPhrase = null, confirmation = "", now = new Date() }) {
  return Boolean(revision) && Object.keys(validateTransition(draft, now)).length === 0 && confirmationMatches(requiredPhrase, confirmation);
}

export function auditUrl(cursor = null) {
  if (!cursor) return AUDIT_ENDPOINT;
  return `${AUDIT_ENDPOINT}?${new URLSearchParams({ cursor: String(cursor) })}`;
}

export function parseAuditPage(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(payload.audit)) throw new TypeError("Malformed audit response.");
  if (payload.cursor !== null && payload.cursor !== undefined && typeof payload.cursor !== "string") throw new TypeError("Malformed audit response.");
  if (payload.audit.some((record) => !record || typeof record !== "object" || Array.isArray(record))) throw new TypeError("Malformed audit response.");
  return { records: payload.audit, cursor: payload.cursor || null };
}

const present = (value) => value !== null && value !== undefined && String(value).trim() !== "";

export function auditRecordFields(record) {
  const action = record.action === "rollback" ? "Rollback" : record.nextState === "disabled" ? "Disable" : record.nextState === "enabled" ? "Enable / restore" : record.nextState === "monitorOnly" ? "Monitor only" : record.action || "Change";
  return [
    ["Changed", present(record.timestamp) ? record.timestamp : "Unknown time"],
    ["Actor", present(record.actor) ? record.actor : "Unknown actor"],
    ["Action", action],
    ["Control", present(record.controlId) ? record.controlId : record.action === "rollback" ? "All controls (snapshot)" : "Not recorded"],
    ["State", present(record.previousState) || present(record.nextState) ? `${record.previousState ?? "unknown"} → ${record.nextState ?? "unknown"}` : "Not recorded"],
    ["Reason code", record.reasonCode], ["Operator reason", record.operatorReason], ["Incident", record.incidentId],
    ["Revision", record.resultingRevision ?? record.revision], ["Expiry", record.expiresAt], ["Override", record.override ?? record.overrideRestore],
  ].filter(([, value]) => present(value));
}

export function classifyAuditFailure(response) {
  if (response.status === 401 || response.status === 403 || response.redirected) return "Your Cloudflare Access session may have expired. Audit history was not loaded.";
  return "Audit history could not be loaded. Current control state is unaffected.";
}

export function classifyControlFailure(response) {
  if (response.status === 412) return "The configuration changed in another session. Refresh before retrying.";
  if (response.status === 401 || response.status === 403 || response.redirected) return "Your Cloudflare Access session may have expired.";
  return "The operational-control request failed. No state change was assumed.";
}
