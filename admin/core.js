export const API_BASE = "/admin/service";
export const SEVERITIES = ["information", "notice", "important", "critical"];
export const ANNOUNCEMENT_TIME_ZONE = "America/Chicago";
export const ACTION_URL_POLICY_MESSAGE = "Use an approved HTTPS link on alabamabeachflag.com or the American Red Cross, without credentials, a port, or a fragment.";
export const ANNOUNCEMENT_ACTION_RULES = Object.freeze({
  "alabamabeachflag.com": null,
  "www.alabamabeachflag.com": null,
  "www.redcross.org": "/take-a-class/resources/learn-first-aid/"
});

export const TEMPLATES = {
  "provider-delay": { title: "Provider Delay", message: "Beach flag updates may be delayed while we investigate an upstream provider issue.", severity: "important" },
  "data-unavailable": { title: "Data Temporarily Unavailable", message: "Beach condition data is temporarily unavailable. Please check back soon.", severity: "important" },
  maintenance: { title: "Scheduled Maintenance", message: "Alabama Beach Flag will be temporarily unavailable during scheduled maintenance.", severity: "notice" },
  update: { title: "New App Version Available", message: "A new version of Alabama Beach Flag is available with the latest improvements.", severity: "information", actionTitle: "View Update", actionUrl: "https://www.alabamabeachflag.com/" },
  jellyfish: { title: "Jellyfish Reported Along the Coast", message: "Jellyfish have been reported in Gulf waters along parts of the Alabama coast today. Use caution while swimming, follow posted beach flags and lifeguard guidance, and avoid touching jellyfish in the water or on the shore.", severity: "notice", actionTitle: "What to Do if Stung", actionUrl: "https://alabamabeachflag.com/resources/jellyfish-stings" },
  general: { title: "App Information", message: "", severity: "information" },
  custom: { title: "", message: "", severity: "information" }
};

function centralParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: ANNOUNCEMENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

export function centralDateId(date = new Date()) {
  const parts = centralParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function centralInputValue(date) {
  const parts = centralParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function centralInputToUtc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const requested = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
  let result = requested;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = centralParts(new Date(result));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    result += requested - represented;
  }
  return centralInputValue(new Date(result)) === value ? new Date(result).toISOString() : null;
}

export function isApprovedAnnouncementActionUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !(hostname in ANNOUNCEMENT_ACTION_RULES)) return false;
    const pathPrefix = ANNOUNCEMENT_ACTION_RULES[hostname];
    return pathPrefix === null || url.pathname.startsWith(pathPrefix);
  } catch { return false; }
}

export function jellyfishTemplateDraft(now = new Date()) {
  const date = centralDateId(now);
  const midnight = new Date(`${date}T12:00:00Z`);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  const nextDate = midnight.toISOString().slice(0, 10);
  return { ...TEMPLATES.jellyfish, id: `jellyfish-${date}`, startsAt: centralInputValue(now), expiresAt: `${nextDate}T00:00` };
}

export function localInputValue(date) {
  return centralInputValue(date);
}

export function toUtc(value) {
  return centralInputToUtc(value);
}

export function expirationForPreset(preset, start, now = new Date()) {
  const base = new Date(start);
  if (Number.isNaN(base.valueOf())) return null;
  const minutes = { "30m": 30, "1h": 60, "4h": 240 }[preset];
  if (minutes) return new Date(base.getTime() + minutes * 60000);
  if (preset !== "midnight" && preset !== "tomorrow") return null;
  const date = new Date(`${centralDateId(now)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  const time = preset === "midnight" ? "00:00" : "23:59";
  const utc = centralInputToUtc(`${date.toISOString().slice(0, 10)}T${time}`);
  return utc ? new Date(utc) : null;
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
  const startsUtc = centralInputToUtc(draft.startsAt);
  const expiresUtc = centralInputToUtc(draft.expiresAt);
  const starts = new Date(startsUtc || "invalid");
  const expires = new Date(expiresUtc || "invalid");
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
      if (!isApprovedAnnouncementActionUrl(draft.actionUrl)) throw new Error();
    } catch { errors.actionUrl = ACTION_URL_POLICY_MESSAGE; }
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
