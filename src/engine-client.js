/**
 * UBC-03 versioned Live Debate Engine client for public API "public-v1".
 * Read-only, anonymous (credentials omitted), bounded by timeout, validates every response.
 */
export const ENGINE_API_VERSION = "public-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class EngineError extends Error {
  constructor(code, status = 0) { super(code); this.name = "EngineError"; this.code = code; this.status = status; }
}
const text = (value, max = 20000) => (typeof value === "string" && value.length <= max ? value : null);
const int = value => (Number.isSafeInteger(value) ? value : null);

/** Validate and project one public event; unknown fields are dropped, malformed data is rejected. */
export function parseEvent(raw) {
  if (!raw || typeof raw !== "object" || !UUID.test(raw.eventId ?? "") || text(raw.title, 240) === null) throw new EngineError("invalid_response");
  const motion = raw.motion && typeof raw.motion === "object"
    ? Object.freeze({ wording: text(raw.motion.wording, 2000) ?? "", description: text(raw.motion.description, 10000) ?? "", categories: Array.isArray(raw.motion.categories) ? raw.motion.categories.filter(c => typeof c === "string").slice(0, 12) : [], revision: int(raw.motion.revision) })
    : null;
  const r = raw.results && typeof raw.results === "object" ? raw.results : null;
  const decision = v => (["for", "against", "tie", "inconclusive"].includes(v) ? v : null);
  const results = r ? Object.freeze({
    version: int(r.version), resultsHash: /^[a-f0-9]{64}$/.test(r.resultsHash ?? "") ? r.resultsHash : null, announcedAt: text(r.announcedAt, 40),
    audience: r.audience ? Object.freeze({ decision: decision(r.audience.decision), cohort: int(r.audience.cohort), preCounts: r.audience.preCounts ?? null, postCounts: r.audience.postCounts ?? null,
      explanation: Array.isArray(r.audience.explanation) ? r.audience.explanation.filter(x => typeof x === "string").slice(0, 5) : [] }) : null,
    judges: r.judges ? Object.freeze({ decision: decision(r.judges.decision), seats: int(r.judges.seats) }) : null,
    advancement: r.advancement && ["for", "against", null].includes(r.advancement.selectedSide) ? Object.freeze({ selectedSide: r.advancement.selectedSide, reason: text(r.advancement.reason, 40) }) : null,
  }) : null;
  const transcript = Array.isArray(raw.transcript)
    ? Object.freeze(raw.transcript.slice(0, 1000).map(s => Object.freeze({ offsetMs: int(s?.offsetMs) ?? 0, text: text(s?.text, 4000) ?? "" })))
    : null;
  return Object.freeze({ eventId: raw.eventId, title: raw.title, venue: text(raw.venue, 500) ?? "", broadcastMode: text(raw.broadcastMode, 40) ?? "none",
    phase: text(raw.phase, 40), motion, results, transcript });
}

export function createEngineClient({ origin, tenantId, fetcher = (...args) => fetch(...args), timeoutMs = 8000 }) {
  if (origin !== null) {
    const url = new URL(origin);
    if (url.origin !== origin || (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))) throw new TypeError("Engine origin must be an HTTPS origin");
  }
  if (tenantId !== null && !UUID.test(tenantId)) throw new TypeError("Invalid tenant id");
  const configured = origin !== null && tenantId !== null;
  async function get(path) {
    if (!configured) throw new EngineError("engine_not_connected");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetcher(`${origin}${path}`, { method: "GET", credentials: "omit", redirect: "error", mode: "cors", headers: { accept: "application/json" }, signal: controller.signal });
    } catch { throw new EngineError("engine_unreachable"); } finally { clearTimeout(timer); }
    if (response.status === 404) throw new EngineError("not_found", 404);
    if (!response.ok) throw new EngineError("engine_unavailable", response.status);
    const data = await response.json().catch(() => null);
    if (!data || data.apiVersion !== ENGINE_API_VERSION) throw new EngineError("unsupported_api_version");
    return data;
  }
  return Object.freeze({
    configured, origin, apiVersion: ENGINE_API_VERSION,
    async listEvents() {
      const data = await get(`/api/public/v1/tenants/${tenantId}/events`);
      if (!Array.isArray(data.events)) throw new EngineError("invalid_response");
      return Object.freeze(data.events.slice(0, 200).map(parseEvent));
    },
    async getEvent(eventId) {
      if (!UUID.test(eventId)) throw new EngineError("not_found", 404);
      return parseEvent((await get(`/api/public/v1/tenants/${tenantId}/events/${eventId}`)).event);
    },
    /** UBC-04: identity, admission and permissions stay in the engine; UBC links to its workspace. */
    participantUrl() { return configured ? `${origin}/` : null; },
  });
}
