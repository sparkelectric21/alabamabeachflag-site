export const EVENT_TYPES = ["festival","raceOrSport","beachCleanup","wildlife","conservation","educational","community","fireworksOrHoliday","accessOrParkingImpact","other"];
export const IMPACT_LEVELS = ["informational","noticeable","high","major"];

export function validateEventDraft(draft) {
  const errors = {};
  if (!draft.title?.trim()) errors.title = "Enter an event title.";
  if (!draft.beachId) errors.beachId = "Choose an exact beach.";
  if (!draft.venue?.trim()) errors.venue = "Enter the exact venue.";
  if (!EVENT_TYPES.includes(draft.eventType)) errors.eventType = "Choose an event type.";
  if (!IMPACT_LEVELS.includes(draft.impactLevel)) errors.impactLevel = "Choose an impact level.";
  if (!draft.bannerTitle?.trim() || !draft.bannerMessage?.trim()) errors.banner = "Enter banner wording.";
  const start = new Date(draft.startAt), end = new Date(draft.endAt);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) errors.dates = "End must follow start.";
  try { if (new URL(draft.sourceURL).protocol !== "https:") errors.sourceURL = "Use an official HTTPS URL."; } catch { errors.sourceURL = "Use an official HTTPS URL."; }
  for (const key of ["officialEventURL","registrationURL","officialEventsPageURL","organizerWebsiteURL"]) if (draft[key]) { try { const url=new URL(draft[key]); if (url.protocol !== "https:" || /\.ics$|webcal|calendar-feed|\/common\/modules\/iCalendar\//i.test(url.pathname+url.hostname)) errors[key] = "Use a trusted public HTTPS webpage, not a calendar feed."; } catch { errors[key] = "Enter a valid URL."; } }
  const publicURLs=[draft.officialEventURL,draft.registrationURL,draft.officialEventsPageURL,draft.organizerWebsiteURL].filter(Boolean);if(new Set(publicURLs).size!==publicURLs.length)errors.publicURLs="Public action URLs must be distinct.";
  if (/<[a-z][\s\S]*>/i.test(`${draft.summary||""} ${draft.fullDescription||""}`)) errors.description = "Remove raw HTML from public copy.";
  return errors;
}

export function statusSummary(events) {
  return events.reduce((result, event) => {
    result[event.status] = (result[event.status] || 0) + 1;
    return result;
  }, {});
}

export function eventMatchesQueue(event, queue, now = new Date()) {
  const flags = new Set(event.attentionFlags || []);
  if (queue === "new") return event.status === "pendingReview" && !event.sourceChange && ![...flags].some(flag => flag !== "normalizationWarning");
  if (queue === "changedAfterApproval") return flags.has("materialSourceChange") || flags.has("sourceRestored") || Boolean(event.sourceChange?.previousStatus && ["approved","scheduled","published"].includes(event.sourceChange.previousStatus));
  if (queue === "ambiguousMatch") return flags.has("ambiguousMatch") || event.matchConfidence === "ambiguous";
  if (queue === "possibleDuplicate") return flags.has("possibleDuplicate") || Boolean(event.possibleDuplicateOf);
  if (queue === "normalizationWarning") return Boolean(event.normalizationWarnings?.length) || flags.has("normalizationWarning");
  if (queue === "publishedAttention") return event.status === "published" && flags.size > 0;
  if (queue === "removedOrCancelled") return event.status === "cancelled" || flags.has("sourceCancelled") || flags.has("sourceRemoved") || flags.has("sourceMissing");
  if (queue === "manual") return event.sourceFacts?.providerId === "manual" || event.id?.startsWith("manual-");
  if (queue === "archive") return event.status === "completed" || event.status === "expired" || Boolean(event.archivedAt);
  if (queue === "expired") return event.status === "expired";
  return event.status === queue;
}

export function archiveMatchesFilters(event, { query = "", dateFrom = "", dateTo = "", beachId = "", providerId = "", terminalStatus = "" } = {}) {
  if (event.status !== "completed" && event.status !== "expired" && !event.archivedAt) return false;
  const text = `${event.title || ""} ${event.venue || ""} ${event.address || ""} ${event.sourceName || ""} ${event.sourceFacts?.providerId || ""}`.toLowerCase();
  if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
  if (dateFrom && Date.parse(event.endAt) < Date.parse(`${dateFrom}T00:00:00`)) return false;
  if (dateTo && Date.parse(event.startAt) >= Date.parse(`${dateTo}T00:00:00`) + 86400000) return false;
  if (beachId && event.beachId !== beachId) return false;
  if (providerId && event.sourceFacts?.providerId !== providerId) return false;
  if (terminalStatus && event.status !== terminalStatus) return false;
  return true;
}

export function candidateMatchesQueue(candidate, queue) {
  if (queue === "possibleDuplicate") return candidate.reason === "duplicate";
  if (queue === "ambiguousMatch") return candidate.reason === "ambiguousLocation";
  return queue === "excluded";
}

export function sourceChangeRows(event) {
  const change = event.sourceChange;
  if (!change) return [];
  const fields = [...new Set([...(change.materialFields || []), ...(change.cosmeticFields || [])])];
  return fields.map(field => ({ field, before: change.previous?.[field], after: change.current?.[field], material: (change.materialFields || []).includes(field) }));
}

export function matchSummary(event) {
  if (event.matchConfidence === "ambiguous") return "Ambiguous source change — review required";
  if (event.matchMethod === "adminOverride") return "Administrator assigned";
  if (event.matchMethod === "exactVenue") return "Exact known venue";
  if (event.matchMethod === "exactAddress") return "Exact beach-access address";
  if (event.matchMethod === "sourceAlias") return "Known provider venue alias";
  return event.matchExplanation || "Match method unavailable";
}

export function refreshEmptyState(refresh) {
  if (!refresh || refresh.status === "neverRun") return "Refresh has not run yet";
  if (refresh.status === "disabled") return "Beach event ingestion is disabled";
  if (refresh.status === "monitorOnly") return "Provider is in monitor-only mode";
  if (refresh.status === "failed") return "Provider refresh failed";
  if (refresh.counts?.raw === 0) return "Refresh succeeded, but no beach-specific events were found";
  if (refresh.counts?.matched === 0) return "Events were fetched, but none matched a supported beach";
  return "Official event sources refreshed";
}

export function eventTimingState(event) {
  if (event?.sourceFacts?.sourceStatus === "postponed" || event?.attentionFlags?.includes("sourcePostponed")) return "postponed";
  if (!event?.startAt) return "unavailable";
  if (event.allDay && event.endAt && String(event.startAt).slice(0, 10) !== String(event.endAt).slice(0, 10)) return "multiDay";
  if (event.allDay) return "allDay";
  if (event.endTimeUnavailable || !event.endAt) return "startOnly";
  return "scheduled";
}

export function nextReviewId(orderedIds, currentId, events) {
  const available = new Set(events.filter(event => event.status === "pendingReview").map(event => event.id));
  const currentIndex = orderedIds.indexOf(currentId);
  return orderedIds.slice(Math.max(0, currentIndex + 1)).find(id => available.has(id)) || orderedIds.slice(0, Math.max(0, currentIndex)).find(id => available.has(id)) || null;
}
