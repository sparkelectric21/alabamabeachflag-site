export const API_BASE = "https://alabamabeachflag-api.sparkelectricalservicesllc.workers.dev";
export const SEVERITIES = ["information", "notice", "important", "critical"];

export const TEMPLATES = {
  "provider-delay": { title: "Provider Delay", message: "Beach flag updates may be delayed while we investigate an upstream provider issue.", severity: "important" },
  "data-unavailable": { title: "Data Temporarily Unavailable", message: "Beach condition data is temporarily unavailable. Please check back soon.", severity: "important" },
  maintenance: { title: "Scheduled Maintenance", message: "Alabama Beach Flag will be temporarily unavailable during scheduled maintenance.", severity: "notice" },
  update: { title: "New App Version Available", message: "A new version of Alabama Beach Flag is available with the latest improvements.", severity: "information", actionTitle: "View Update", actionUrl: "https://www.alabamabeachflag.com/" },
  general: { title: "App Information", message: "", severity: "information" },
  custom: { title: "", message: "", severity: "information" }
};

export function localInputValue(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function toUtc(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function expirationForPreset(preset, start, now = new Date()) {
  const base = new Date(start);
  if (Number.isNaN(base.valueOf())) return null;
  const minutes = { "30m": 30, "1h": 60, "4h": 240 }[preset];
  if (minutes) return new Date(base.getTime() + minutes * 60000);
  const result = new Date(now);
  if (preset === "midnight") result.setHours(24, 0, 0, 0);
  else if (preset === "tomorrow") result.setDate(result.getDate() + 1), result.setHours(23, 59, 0, 0);
  else return null;
  return result;
}

export function validateDraft(draft, now = new Date()) {
  const errors = {};
  const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const unsafe = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
  const plain = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max && !unsafe.test(value);
  if (!idPattern.test(draft.id || "")) errors.id = "Use 1–128 letters, numbers, periods, underscores, or hyphens.";
  if (!plain(draft.title, 80)) errors.title = "Enter 1–80 plain-text characters.";
  if (!plain(draft.message, 500)) errors.message = "Enter 1–500 plain-text characters.";
  if (!SEVERITIES.includes(draft.severity)) errors.severity = "Choose a supported severity.";
  const starts = new Date(draft.startsAt);
  const expires = new Date(draft.expiresAt);
  if (Number.isNaN(starts.valueOf())) errors.startsAt = "Choose a valid start time.";
  if (Number.isNaN(expires.valueOf())) errors.expiresAt = "Choose a valid expiration time.";
  if (!errors.startsAt && !errors.expiresAt && expires <= starts) errors.expiresAt = "Expiration must be later than the start time.";
  if (!errors.expiresAt && expires <= now) errors.expiresAt = "Expiration must be in the future.";
  const hasActionTitle = Boolean(draft.actionTitle?.trim());
  const hasActionUrl = Boolean(draft.actionUrl?.trim());
  if (hasActionTitle !== hasActionUrl) errors.action = "Provide both an action title and URL, or leave both blank.";
  if (hasActionTitle && !plain(draft.actionTitle, 40)) errors.actionTitle = "Enter 1–40 plain-text characters.";
  if (hasActionUrl) {
    try {
      const url = new URL(draft.actionUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !["alabamabeachflag.com", "www.alabamabeachflag.com"].includes(url.hostname.toLowerCase())) throw new Error();
    } catch { errors.actionUrl = "Use HTTPS on alabamabeachflag.com, without credentials, a port, or fragment."; }
  }
  return errors;
}

export function payloadFromDraft(draft) {
  return {
    id: draft.id.trim(), title: draft.title.trim(), message: draft.message.trim(), severity: draft.severity,
    startsAt: toUtc(draft.startsAt), expiresAt: toUtc(draft.expiresAt),
    actionTitle: draft.actionTitle.trim() || null, actionUrl: draft.actionUrl.trim() || null
  };
}

export function classifyFailure({ status = 0, redirected = false, contentType = "", network = false }) {
  if (network) return "Could not reach the announcement service. Check your connection and try again.";
  if (redirected || contentType.includes("text/html")) return "Your Cloudflare Access session may have expired. Re-authenticate, then try again.";
  if (status === 401 || status === 403) return "Access was denied. Your session may have expired or your account may not be authorized.";
  if (status === 400) return "The service rejected one or more fields. Review the details below.";
  if (status >= 500) return "The announcement service is temporarily unavailable. Your draft has been preserved.";
  return "The request could not be completed. Your draft has been preserved.";
}
