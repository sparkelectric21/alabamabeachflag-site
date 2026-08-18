export const EVENT_TYPES = ["festival","raceOrSport","beachCleanup","wildlife","conservation","educational","community","fireworksOrHoliday","accessOrParkingImpact","other"];
export const IMPACT_LEVELS = ["informational","noticeable","high","major"];

export function locationPresentation(event) {
  const location=event?.location;
  if(!location)return {label:"Location classification not yet assessed",related:"Legacy assignment retained",evidence:[],conflicts:[],warning:false,origin:event?.matchMethod==="adminOverride"?"Administrator":"Legacy / unknown"};
  const labels={beachSpecific:"At this beach",nearbyCoastal:"Nearby coastal",regional:"Regional",irrelevant:"Not beach relevant"};
  return {label:labels[location.classification]||location.precisionLabel||"Uncertain location",related:location.proposedBeachId||location.region||"No exact beach",evidence:(location.evidence||[]).map(item=>`${item.supportsExact?"Supports exact":"Context only"}: ${item.value}`),conflicts:location.conflicts||[],warning:Boolean(event.locationReviewRequired||(location.conflicts||[]).length),origin:location.assignmentOrigin==="administrator"?"Administrator":location.assignmentOrigin==="rule"?"Rule-derived":"Source-derived"};
}

export function confirmationPresentation(event) {
  const value=event?.confirmation;
  if(!value)return {state:"Confirmation metadata unavailable",detail:"Legacy event — current publication behavior retained",warning:false};
  const labels={confirmed:"Confirmed",aging:"Confirmation aging",suspectedMissing:"Suspected missing",sourceRemoved:"Removed at source",cancelled:"Cancelled",postponed:"Postponed",completed:"Completed",archived:"Completed and archived",manualReviewDue:"Manual review due"};
  const timing=[value.lastConfirmedAt?`last confirmed ${value.lastConfirmedAt}`:null,value.firstAbsentAt?`first absent ${value.firstAbsentAt}`:null,`${value.successfulChecksAbsent||0} complete checks absent`,value.policyId,value.observationCompleteness].filter(Boolean).join(" · ");
  return {state:labels[value.status]||value.status,detail:`${timing} · ${value.reason||"No reason recorded"}`,warning:["suspectedMissing","sourceRemoved","cancelled","postponed","manualReviewDue"].includes(value.status)};
}

export function duplicateReviewPresentation(event, events=[]) {
  const assessment=event?.duplicateAssessment||event?.duplicateCandidates?.[0]||(event?.possibleDuplicateOf?{eventIds:[event.id,event.possibleDuplicateOf],classification:"possibleDuplicate",positiveEvidence:["Legacy duplicate pointer — evidence unavailable"],conflictingEvidence:[],titleTokens:{},proposedRelationship:"keepSeparate",recommendedAction:"reviewPossibleDuplicate"}:null);
  if(!assessment)return null;
  const [leftId,rightId]=assessment.eventIds||[],left=events.find(item=>item.id===leftId)||(event.id===leftId?event:null),right=events.find(item=>item.id===rightId)||(event.id===rightId?event:null);
  const side=item=>item?{id:item.id,provider:item.sourceFacts?.providerId||"unknown",authority:item.sourceFacts?.providerId==="manual"?"Manual submission":"Official/imported source",externalId:item.sourceFacts?.externalId||"unavailable",recurrenceId:item.sourceFacts?.recurrenceId,title:item.title,startAt:item.startAt,endAt:item.endAt,venue:item.venue,locationClass:item.location?.classification||item.locationClass||"legacy",relatedBeach:item.location?.proposedBeachId||item.beachId,organizer:item.sourceName,canonicalURL:item.officialEventURL||item.sourceFacts?.officialURL,status:item.status,sourceRevision:item.sourceRevision}:null;
  return {classification:assessment.classification,left:side(left),right:side(right),titleTokens:assessment.titleTokens||{},positiveEvidence:assessment.positiveEvidence||[],conflictingEvidence:assessment.conflictingEvidence||[],proposedCanonicalEventId:assessment.proposedCanonicalEventId,proposedRelationship:assessment.proposedRelationship,recommendedAction:assessment.recommendedAction,summary:`${assessment.classification}: ${(assessment.positiveEvidence||[]).join("; ")||"no positive evidence"}${assessment.conflictingEvidence?.length?` · Conflicts: ${assessment.conflictingEvidence.join("; ")}`:""}`};
}

export function appendDuplicateReview(container,event,events,createElement) {
  const view=duplicateReviewPresentation(event,events);if(!view?.left||!view?.right)return null;
  const section=createElement("section"),heading=createElement("h3"),summary=createElement("p"),grid=createElement("div");
  section.className="duplicate-review";heading.textContent="Possible duplicate comparison";summary.textContent=view.summary;grid.className="duplicate-review-grid";
  const fields=["authority","provider","externalId","recurrenceId","title","startAt","endAt","venue","locationClass","relatedBeach","organizer","canonicalURL","status","sourceRevision"];
  for(const side of [view.left,view.right]){const article=createElement("article"),title=createElement("h4");title.textContent=side.id;article.append(title);for(const field of fields){const row=createElement("p");row.textContent=`${field}: ${side[field]??"—"}`;article.append(row)}grid.append(article)}
  const evidence=createElement("p");evidence.textContent=`Supporting evidence: ${view.positiveEvidence.join("; ")||"none"} · Conflicting evidence: ${view.conflictingEvidence.join("; ")||"none"} · Proposed canonical: ${view.proposedCanonicalEventId||"none"} · Relationship: ${view.proposedRelationship||"undecided"} · Recommended action: ${view.recommendedAction||"manual review"}`;
  section.append(heading,summary,grid,evidence);container.append(section);return section;
}

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
  return fields.map(field => ({ field, before: change.previous?.[field], after: change.current?.[field], material: (change.materialFields || []).includes(field), severity:change.severity||((change.materialFields||[]).includes(field)?"material":"cosmetic"), explanation:(change.explanations||[]).join("; ")||"Normalized source comparison" }));
}

export function matchSummary(event) {
  const location=locationPresentation(event);
  const confirmation=confirmationPresentation(event),confirmationText=event.confirmation?` · ${confirmation.state}: ${confirmation.detail}${confirmation.warning?" — REVIEW":""}`:"";
  const sourceChangeText=event.sourceChange?` · Source change: ${event.sourceChange.severity||"unclassified"}${event.sourceChange.explanations?.length?` — ${event.sourceChange.explanations.join("; ")}`:""}`:"";
	const overlayText=event.confirmationAudit?` · Provider overlay: ${event.confirmationAudit.providerHealth} · ${event.confirmationAudit.qualifyingCompleteObservation?"qualifying complete observation":"no qualifying absence observation"}`:"";
	const latestObservation=event.sourceObservations?.at(-1),observationText=latestObservation?` · Source observed ${latestObservation.observedAt} · ${latestObservation.completeness} · ${latestObservation.sourceReference||"reference unavailable"}`:"";
	const duplicate=duplicateReviewPresentation(event),duplicateText=duplicate?` · Duplicate assessment: ${duplicate.summary}`:"";
	if(event.location){const primaryEvidence=location.evidence.find(item=>item.startsWith("Supports exact:"))||location.evidence[0];const evidence=primaryEvidence?` · ${primaryEvidence}`:"";const conflict=location.warning?` · REVIEW: ${location.conflicts.join("; ")||"retained assignment conflicts with source evidence"}`:"";return `${location.label} · ${location.related} · ${location.origin}${evidence}${conflict}${confirmationText}${sourceChangeText}${overlayText}${observationText}${duplicateText}`;}
	const match=event.matchConfidence === "ambiguous"?"Ambiguous source change — review required"
    :event.matchMethod === "adminOverride"?"Administrator assigned"
    :event.matchMethod === "exactVenue"?"Exact known venue"
    :event.matchMethod === "exactAddress"?"Exact beach-access address"
    :event.matchMethod === "sourceAlias"?"Known provider venue alias"
    :event.matchExplanation||"Match method unavailable";
  return `${match}${confirmationText}${sourceChangeText}${overlayText}${observationText}${duplicateText}`;
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
