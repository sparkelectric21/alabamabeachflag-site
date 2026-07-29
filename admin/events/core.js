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
  return errors;
}

export function statusSummary(events) {
  return events.reduce((result, event) => {
    result[event.status] = (result[event.status] || 0) + 1;
    return result;
  }, {});
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
