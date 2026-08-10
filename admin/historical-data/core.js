export const SUMMARY_ENDPOINT = "/admin/service/admin/historical-data";
export const OBSERVATIONS_ENDPOINT = `${SUMMARY_ENDPOINT}/observations`;
export const AREA_NAMES = { gulfShores: "Gulf Shores", orangeBeach: "Orange Beach", fortMorgan: "Fort Morgan", dauphinIsland: "Dauphin Island" };
export const DATASET_NAMES = { beach_flag: "Beach flags", water_temperature: "Water temperature", tide_high: "Tide high", tide_low: "Tide low", water_quality_enterococcus: "ADEM enterococcus", water_quality_advisory: "ADEM advisory state" };

export function formatTime(value) {
  if (!value) return "Not available";
  const date = new Date(value); if (Number.isNaN(date.valueOf())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Chicago", timeZoneName: "short"
  }).format(date);
}
export function formatCount(value) { return Number(value || 0).toLocaleString("en-US"); }
export function healthLabel(status) { return ({ healthy: "Healthy", late: "Stale", never_succeeded: "Failing", not_scheduled: "Not configured" })[status] || "Unavailable"; }
export function failureMessage(response = {}) {
  if (response.redirected || response.status === 401 || response.status === 403 || String(response.contentType || "").includes("text/html")) return "Your Cloudflare Access session may have expired. Re-authenticate, then refresh.";
  if (response.status === 503 && response.notConfigured) return "Historical D1 is not configured in this environment.";
  return "Historical data is temporarily unavailable. No public API is affected.";
}
export function observationQuery(form, cursor = null) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) if (value !== "" && value != null) params.set(key, value);
  if (cursor) params.set("cursor", cursor);
  return `${OBSERVATIONS_ENDPOINT}?${params}`;
}
export function centralWallTimeToIso(value, overlapPolicy = "earlier") {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new RangeError("Enter a valid Central Time date and time.");
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number), second = Number(match[6] ?? 0);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const matches = [5, 6].map(offset => new Date(Date.UTC(year, month - 1, day, hour + offset, minute, second))).filter(date => {
    const shown = Object.fromEntries(formatter.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
    return shown.year === year && shown.month === month && shown.day === day && shown.hour === hour && shown.minute === minute && shown.second === second;
  }).sort((a, b) => a - b);
  if (!matches.length) throw new RangeError("This Central Time does not exist because clocks move forward. Choose another time.");
  return matches[overlapPolicy === "later" ? matches.length - 1 : 0].toISOString();
}
export function normalizeObservationFilters(form) {
  const normalized = { ...form };
  for (const key of ["observedFrom", "observedTo", "storedFrom", "storedTo"]) normalized[key] = centralWallTimeToIso(form[key]);
  if (normalized.observedFrom && normalized.observedTo && normalized.observedFrom > normalized.observedTo) throw new RangeError("Observation From must be before or equal to Observation To.");
  if (normalized.storedFrom && normalized.storedTo && normalized.storedFrom > normalized.storedTo) throw new RangeError("Stored From must be before or equal to Stored To.");
  return normalized;
}
export function timestampLabel(row) {
  return ({ predicted_event: "Predicted event", sample_date: "Sample/result date", inferred_snapshot: "Inferred flag snapshot", provider_observation: "Source observation" })[row.observation_time_basis] || "Source time";
}
export function chartPoints(rows, width = 640, height = 150, valueKey = "inserted") {
  if (!rows.length) return ""; const values = rows.map(row => Number(row[valueKey] || 0)); const max = Math.max(...values, 1);
  return values.map((value, index) => `${rows.length === 1 ? width / 2 : index * width / (rows.length - 1)},${height - value / max * (height - 12)}`).join(" ");
}
