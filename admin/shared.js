export const ADMIN_TIME_ZONE = "America/Chicago";

export class AdminRequestError extends Error {
  constructor(message, { kind, status = 0, payload = null, response = null, cause } = {}) { super(message, { cause }); this.name = "AdminRequestError"; this.kind = kind; this.status = status; this.payload = payload; this.response = response; }
}
export async function requestJson(url, options = {}) {
  const { expectedStatuses, ...fetchOptions } = options; const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (fetchOptions.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response; try { response = await fetch(url, { credentials: "include", cache: "no-store", ...fetchOptions, headers }); }
  catch (cause) { if (cause?.name === "AbortError") throw cause; throw new AdminRequestError("The request could not reach the service.", { kind: "transport", cause }); }
  const contentType = response.headers.get("content-type") || "";
  if (response.redirected || response.status === 401 || response.status === 403 || contentType.includes("text/html")) throw new AdminRequestError("Your admin Access session may have expired. Re-authenticate and try again.", { kind: "access", status: response.status, response });
  let payload = null;
  if (contentType.includes("json")) { try { payload = await response.json(); } catch (cause) { throw new AdminRequestError("The service returned malformed JSON.", { kind: "malformed", status: response.status, response, cause }); } }
  const accepted = expectedStatuses ? expectedStatuses.includes(response.status) : response.ok;
  if (!accepted) throw new AdminRequestError(payload?.error || `Request failed (${response.status}).`, { kind: "http", status: response.status, payload, response });
  if (!contentType.includes("json")) throw new AdminRequestError("The service returned an unexpected response.", { kind: "malformed", status: response.status, response });
  return payload;
}

const wallFormatter = new Intl.DateTimeFormat("en-US", { timeZone: ADMIN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export function centralParts(date) { return Object.fromEntries(wallFormatter.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value])); }
export function formatCentralTime(value, fallback = "Not available") { if (!value) return fallback; const date = new Date(value); if (Number.isNaN(date.valueOf())) return fallback; return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: ADMIN_TIME_ZONE, timeZoneName: "short" }).format(date); }
export function centralInputValue(value) { const date = value instanceof Date ? value : new Date(value); if (Number.isNaN(date.valueOf())) return ""; const p = centralParts(date); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; }
export function centralWallTimeToIso(value, overlapPolicy = "earlier") {
  if (!value) return ""; const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value); if (!match) throw new RangeError("Enter a valid Central Time date and time.");
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number), second = Number(match[6] || 0);
  const matches = [5, 6].map(offset => new Date(Date.UTC(year, month - 1, day, hour + offset, minute, second))).filter(date => { const p = centralParts(date); return +p.year === year && +p.month === month && +p.day === day && +p.hour === hour && +p.minute === minute && +p.second === second; }).sort((a, b) => a - b);
  if (!matches.length) throw new RangeError("This Central Time does not exist because clocks move forward. Choose another time."); return matches[overlapPolicy === "later" ? matches.length - 1 : 0].toISOString();
}
export function setNotice(node, message, { kind = "status" } = {}) { node.textContent = message; node.hidden = !message; node.classList.toggle("error", kind === "error"); node.setAttribute("role", kind === "error" ? "alert" : "status"); }
