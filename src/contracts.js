/** UBC presentation contract v2: branded routes over the engine's versioned public API. */
import { ENGINE_API_VERSION, EngineError } from "./engine-client.js";

export const CONTRACT_VERSION = 2;
export const ENGINE_DEPENDENCY = Object.freeze({
  repository: "Galinsky-Labs/Live-Debate-Engine",
  apiVersion: ENGINE_API_VERSION,
  integration: "public-read",
  // Decision (owner, 2026-11-15): build against the current engine API, not engine V1 (E-47).
  basis: "current-engine-api",
});

export const ROUTES = Object.freeze([
  Object.freeze({ id: "home", hash: "#/", label: "Overview", title: "A place for thoughtful debate" }),
  Object.freeze({ id: "program", hash: "#/program", label: "Program", title: "Debate program" }),
  Object.freeze({ id: "debates", hash: "#/debates", label: "Debates", title: "Explore debates" }),
  Object.freeze({ id: "speakers", hash: "#/speakers", label: "Speakers", title: "Meet the speakers" }),
  Object.freeze({ id: "participant", hash: "#/participant", label: "Participant area", title: "Participant area" }),
]);
export const DEBATE_ROUTE = Object.freeze({ id: "debate", label: "Debate", title: "Debate" });
const DETAIL = /^#\/debates\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

/** Fixed allow-list plus one strictly-validated detail pattern; nothing else is interpreted. */
export function resolveRoute(hash) {
  if (hash === "" || hash === "#") return Object.freeze({ route: ROUTES[0], param: null });
  const fixed = ROUTES.find(route => route.hash === hash);
  if (fixed) return Object.freeze({ route: fixed, param: null });
  const detail = typeof hash === "string" ? DETAIL.exec(hash) : null;
  return detail ? Object.freeze({ route: DEBATE_ROUTE, param: detail[1] }) : null;
}

const PHASE_LABELS = Object.freeze({ preparation: "Preparing", readiness: "Final checks", "pre-vote": "Opening vote", openings: "Opening statements", discussion: "Discussion",
  questions: "Audience questions", closings: "Closing statements", "post-vote": "Final vote", verification: "Results being verified", announcement: "Results announced", closed: "Concluded", cancelled: "Cancelled" });
const SIDE = Object.freeze({ for: "For the motion", against: "Against the motion", tie: "Tie", inconclusive: "Held for review" });
export const phaseLabel = phase => (phase ? PHASE_LABELS[phase] ?? "Scheduled" : "Scheduled");
const isLive = phase => ["pre-vote", "openings", "discussion", "questions", "closings", "post-vote"].includes(phase);
const debateLink = event => Object.freeze({ text: event.title, href: `#/debates/${event.eventId}`, detail: `${event.motion?.wording ?? "Motion to be announced"} · ${phaseLabel(event.phase)}` });

/** Load route data through the engine client and return a renderable, text-only view model. */
export async function loadView(resolved, client) {
  const { route, param } = resolved;
  const base = { title: route.title, sections: [], status: "Connected", message: "" };
  try {
    if (route.id === "participant") {
      const url = client.participantUrl();
      return Object.freeze({ ...base, status: url ? "Sign in through Live Debate Engine" : "Not connected",
        message: "Registration, sign-in, multi-factor security, admission, voting credentials and your role permissions are managed by the Live Debate Engine. UBC Debates never stores your password or grants permissions.",
        sections: url ? [{ heading: "Continue", items: [{ text: "Open the participant workspace", href: url, external: true }] }] : [] });
    }
    if (!client.configured) return Object.freeze({ ...base, status: "Not connected", message: "Live Debate Engine is not connected yet. Published program, debate and speaker information will appear here when available." });
    if (route.id === "speakers") return Object.freeze({ ...base, status: "Coming soon", message: "Speaker profiles are not yet published through the engine's public API." });
    if (route.id === "debate") {
      const event = await client.getEvent(param);
      const sections = [{ heading: "Motion", items: [{ text: event.motion?.wording ?? "Motion to be announced" }, ...(event.motion?.description ? [{ text: event.motion.description }] : [])] },
        { heading: "Status", items: [{ text: phaseLabel(event.phase) }, { text: `Venue: ${event.venue || "To be announced"}` }, { text: `Broadcast: ${event.broadcastMode === "public-stream" ? "Public stream" : event.broadcastMode === "none" ? "In person only" : "Recording or private stream"}` }] }];
      if (isLive(event.phase)) sections.push({ heading: "Live now", items: [{ text: "This debate is in progress. Registered audience members vote and ask questions in the participant workspace.", href: client.participantUrl(), external: true }] });
      if (event.results) {
        const items = [];
        if (event.results.audience) items.push({ text: `Audience: ${SIDE[event.results.audience.decision] ?? "Unknown"} (${event.results.audience.cohort ?? 0} paired voters)` }, ...event.results.audience.explanation.map(t => ({ text: t })));
        if (event.results.judges) items.push({ text: `Judges: ${SIDE[event.results.judges.decision] ?? "Unknown"}` });
        if (event.results.advancement?.selectedSide) items.push({ text: `Advances: ${SIDE[event.results.advancement.selectedSide]}` });
        if (event.results.resultsHash) items.push({ text: `Certified results fingerprint ${event.results.resultsHash.slice(0, 16)}… (version ${event.results.version})` });
        sections.push({ heading: "Certified results", items });
      }
      if (event.transcript?.length) sections.push({ heading: "Transcript", transcript: true, items: event.transcript.map(s => ({ text: s.text, time: s.offsetMs })) });
      return Object.freeze({ ...base, title: event.title, status: phaseLabel(event.phase), message: event.results ? "Results have been certified and announced." : "Follow this debate as it happens.", sections });
    }
    const events = await client.listEvents();
    if (route.id === "home") {
      const live = events.filter(e => isLive(e.phase));
      return Object.freeze({ ...base, message: live.length ? `${live.length} debate${live.length === 1 ? " is" : "s are"} live now.` : events.length ? "Browse the program and past debates." : "No debates have been published yet.",
        sections: live.length ? [{ heading: "Live now", items: live.map(debateLink) }] : [] });
    }
    const list = route.id === "program" ? events.filter(e => !e.results) : events.filter(e => e.results || ["closed", "announcement"].includes(e.phase));
    return Object.freeze({ ...base, message: list.length ? "" : route.id === "program" ? "No upcoming debates are published yet." : "No concluded debates are published yet.", sections: list.length ? [{ heading: route.id === "program" ? "Upcoming and live" : "Archive", items: list.map(debateLink) }] : [] });
  } catch (error) {
    const code = error instanceof EngineError ? error.code : "engine_unavailable";
    return Object.freeze({ ...base, title: code === "not_found" ? "Debate not found" : route.title, status: code === "not_found" ? "Not found" : "Temporarily unavailable",
      message: code === "not_found" ? "This debate is not published." : "The debate service could not be reached. Please try again shortly.", sections: [] });
  }
}
