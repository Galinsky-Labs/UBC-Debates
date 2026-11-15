import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES, resolveRoute, loadView, ENGINE_DEPENDENCY } from "../src/contracts.js";
import { createEngineClient } from "../src/engine-client.js";

const tenant = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const hash = "a".repeat(64);
const liveEvent = { eventId, title: "Should cities ban cars?", venue: "Chan Centre", broadcastMode: "public-stream", phase: "discussion", motion: { wording: "This house would ban private cars downtown.", description: "Urban policy", categories: ["Policy"], revision: 2 }, results: null, transcript: null };
const pastEvent = { ...liveEvent, eventId: "33333333-3333-4333-8333-333333333333", title: "Past debate", phase: "closed",
  results: { version: 1, resultsHash: hash, announcedAt: "2027-01-01T00:00:00.000Z", audience: { decision: "for", cohort: 7, explanation: ["Larger gain: for."] }, judges: { decision: "for", seats: 3 }, advancement: { selectedSide: "for", reason: "audience" } },
  transcript: [{ offsetMs: 61000, text: "Thank you, Madam Chair." }] };
function fakeFetch(map) {
  const calls = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); const body = map(url); return { ok: body.status === undefined, status: body.status ?? 200, json: async () => body }; };
  return { fetcher, calls };
}
const engine = (map) => { const f = fakeFetch(map); return { client: createEngineClient({ origin: "https://engine.example", tenantId: tenant, fetcher: f.fetcher }), calls: f.calls }; };

test("routes: fixed allow-list plus strictly validated debate detail", () => {
  for (const route of ROUTES) assert.equal(resolveRoute(route.hash).route, route);
  assert.equal(resolveRoute(`#/debates/${eventId}`).param, eventId);
  for (const value of ["#/admin", "#/<script>", "https://evil.example", "#/participant?role=admin", "#/debates/../participant", `#/debates/${eventId}/x`, "#/debates/not-a-uuid", null]) assert.equal(resolveRoute(value), null);
  assert.equal(ENGINE_DEPENDENCY.repository, "Galinsky-Labs/Live-Debate-Engine"); assert.equal(ENGINE_DEPENDENCY.apiVersion, "public-v1");
});

test("unconfigured engine performs no network calls and grants nothing", async () => {
  const original = globalThis.fetch; let calls = 0; globalThis.fetch = () => { calls++; throw Error("forbidden"); };
  try {
    const client = createEngineClient({ origin: null, tenantId: null });
    for (const route of ROUTES) assert.match((await loadView({ route, param: null }, client)).status, /Not connected|Coming soon/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("home, program, archive and detail views render engine data with live state and certified results", async () => {
  const { client, calls } = engine((url) => url.endsWith("/events") ? { apiVersion: "public-v1", events: [liveEvent, pastEvent] } : url.endsWith(pastEvent.eventId) ? { apiVersion: "public-v1", event: pastEvent } : { status: 404, error: "not_found" });
  const home = await loadView(resolveRoute("#/"), client);
  assert.match(home.message, /1 debate is live now/); assert.equal(home.sections[0].items[0].href, `#/debates/${eventId}`);
  assert.equal((await loadView(resolveRoute("#/program"), client)).sections[0].items.length, 1);
  assert.equal((await loadView(resolveRoute("#/debates"), client)).sections[0].items[0].text, "Past debate");
  const detail = await loadView(resolveRoute(`#/debates/${pastEvent.eventId}`), client);
  assert.equal(detail.title, "Past debate");
  const results = detail.sections.find((s) => s.heading === "Certified results");
  assert.match(results.items[0].text, /For the motion \(7 paired voters\)/);
  assert.ok(detail.sections.find((s) => s.transcript).items[0].text.includes("Madam Chair"));
  assert.equal((await loadView(resolveRoute(`#/debates/${eventId}`), client)).title, "Debate not found");
  assert.ok(calls.every((c) => c.init.credentials === "omit" && c.init.redirect === "error"));
});

test("participant area defers identity and permissions to the engine", async () => {
  const { client } = engine(() => ({ apiVersion: "public-v1", events: [] }));
  const view = await loadView(resolveRoute("#/participant"), client);
  assert.equal(view.sections[0].items[0].href, "https://engine.example/"); assert.match(view.message, /never stores your password/);
});
