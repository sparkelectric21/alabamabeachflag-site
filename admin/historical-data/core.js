export const SUMMARY_ENDPOINT = "/admin/service/admin/historical-data";
export const OBSERVATIONS_ENDPOINT = `${SUMMARY_ENDPOINT}/observations`;
export const AREA_NAMES = { gulfShores: "Gulf Shores", orangeBeach: "Orange Beach", fortMorgan: "Fort Morgan", dauphinIsland: "Dauphin Island" };
export const DATASET_NAMES = { beach_flag: "Beach flags", water_temperature: "Water temperature", tide_high: "Tide high", tide_low: "Tide low", water_quality_enterococcus: "ADEM enterococcus", water_quality_advisory: "ADEM advisory state" };
import { centralWallTimeToIso, formatCentralTime } from "../shared.js";

export const formatTime = formatCentralTime;
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
export { centralWallTimeToIso };
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
export function chartSegments(rows, width = 640, height = 150, valueKey = "inserted", intervalMs = 3600000) {
  if (!rows.length) return [];
  const times = rows.map(row => Date.parse(row.bucket ?? row.hour ?? row.stored_at));
  const validTimes = times.filter(Number.isFinite), start = Math.min(...validTimes), end = Math.max(...validTimes);
  const values = rows.map(row => Number(row[valueKey] || 0)), max = Math.max(...values, 1);
  const points = rows.map((row, index) => ({ time: times[index], point: `${start === end ? width / 2 : (times[index] - start) * width / (end - start)},${height - values[index] / max * (height - 12)}` }));
  const segments = [];
  for (const item of points) { const previous = segments.at(-1)?.at(-1); if (!previous || !Number.isFinite(item.time) || !Number.isFinite(previous.time) || item.time - previous.time > intervalMs * 1.5) segments.push([]); segments.at(-1).push(item); }
  return segments.map(segment => segment.map(item => item.point).join(" "));
}
