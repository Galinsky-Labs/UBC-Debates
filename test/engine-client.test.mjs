import test from "node:test";
import assert from "node:assert/strict";
import { createEngineClient, parseEvent, EngineError } from "../src/engine-client.js";

const tenant = "11111111-1111-4111-8111-111111111111";
const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });
test("client requires an exact HTTPS origin and UUID tenant", () => {
  assert.throws(() => createEngineClient({ origin: "http://engine.example", tenantId: tenant }), /HTTPS/);
  assert.throws(() => createEngineClient({ origin: "https://engine.example/path", tenantId: tenant }), /HTTPS/);
  assert.throws(() => createEngineClient({ origin: "https://engine.example", tenantId: "x" }), /tenant/);
});
test("client rejects unsupported API versions, malformed events and network failures", async () => {
  await assert.rejects(createEngineClient({ origin: "https://e.example", tenantId: tenant, fetcher: ok({ apiVersion: "public-v2", events: [] }) }).listEvents(), (e) => e.code === "unsupported_api_version");
  await assert.rejects(createEngineClient({ origin: "https://e.example", tenantId: tenant, fetcher: ok({ apiVersion: "public-v1", events: [{ eventId: "x" }] }) }).listEvents(), (e) => e.code === "invalid_response");
  await assert.rejects(createEngineClient({ origin: "https://e.example", tenantId: tenant, fetcher: async () => { throw new Error("down"); } }).listEvents(), (e) => e instanceof EngineError && e.code === "engine_unreachable");
  await assert.rejects(createEngineClient({ origin: "https://e.example", tenantId: tenant, fetcher: async () => ({ ok: false, status: 503, json: async () => ({}) }) }).listEvents(), (e) => e.code === "engine_unavailable");
  await assert.rejects(createEngineClient({ origin: "https://e.example", tenantId: tenant, fetcher: ok({}) }).getEvent("../admin"), (e) => e.code === "not_found");
});
test("client aborts slow responses", async () => {
  const slow = (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  await assert.rejects(createEngineClient({ origin: "https://e.example", tenantId: tenant, fetcher: slow, timeoutMs: 20 }).listEvents(), (e) => e.code === "engine_unreachable");
});
test("parser drops unknown fields and coerces only known shapes", () => {
  const e = parseEvent({ eventId: "22222222-2222-4222-8222-222222222222", title: "T", injected: "<script>", results: { resultsHash: "zz", audience: { decision: "hack" } } });
  assert.equal("injected" in e, false); assert.equal(e.results.resultsHash, null); assert.equal(e.results.audience.decision, null);
});
