export const CONTROL_ENDPOINT = "/admin/service/admin/operational-control";
export const AUDIT_ENDPOINT = `${CONTROL_ENDPOINT}/audit`;

export const IMPACT = {
  "global.liveData": "All live flag providers and beaches",
  "domains.beachFlags": "All beach-flag locations",
  "providers.gulfShoresFlags": "Gulf Shores locations and inherited Fort Morgan",
  "providers.orangeBeachFlags": "Orange Beach locations only"
};

export function expiryForPreset(preset, now = new Date()) {
  const minutes = { "30m": 30, "1h": 60, "6h": 360 }[preset];
  return minutes ? new Date(now.getTime() + minutes * 60_000).toISOString() : null;
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
  return state === "disabled" && ["global.liveData", "domains.beachFlags"].includes(controlId);
}

export function classifyControlFailure(response) {
  if (response.status === 412) return "The configuration changed in another session. Refresh before retrying.";
  if (response.status === 401 || response.status === 403 || response.redirected) return "Your Cloudflare Access session may have expired.";
  return "The operational-control request failed. No state change was assumed.";
}
