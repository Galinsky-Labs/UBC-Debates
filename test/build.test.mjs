import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { build, deploymentConfig } from "../scripts/build.mjs";

const env = { UBC_ENGINE_ORIGIN: "https://live-debate-engine.onrender.com", UBC_TENANT_ID: "11111111-1111-4111-8111-111111111111", UBC_TEST_SECRET: "synthetic-NEVER-EMBED-env-value" };
test("clean static build is deterministic, scoped to the engine origin and embeds no other environment values", async t => {
  const dir = await mkdtemp(join(tmpdir(), "ubc-build-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const first = await build(dir, env); const second = await build(dir, env);
  assert.deepEqual(first, second);
  assert.deepEqual((await readdir(dir)).sort(), ["app.js", "build-manifest.json", "config.js", "contracts.js", "engine-client.js", "index.html", "styles.css"]);
  for (const [name, hash] of Object.entries(first.assets)) {
    const bytes = await readFile(join(dir, name));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
    assert.equal(bytes.toString().includes(env.UBC_TEST_SECRET), false);
  }
  const html = await readFile(join(dir, "index.html"), "utf8");
  assert.match(html, /connect-src https:\/\/live-debate-engine\.onrender\.com;/);
  assert.match(html, /script-src 'self'/); assert.match(html, /<html lang="en">/);
  assert.match(await readFile(join(dir, "config.js"), "utf8"), /11111111-1111-4111-8111-111111111111/);
  assert.equal(first.engineIntegration, "configured");
  assert.equal((await build(dir, {})).engineIntegration, "not-configured");
  assert.match(await readFile(join(dir, "index.html"), "utf8"), /connect-src 'none'/);
});
test("deployment config rejects unsafe values", () => {
  for (const bad of [{ UBC_ENGINE_ORIGIN: "http://engine.example" }, { UBC_ENGINE_ORIGIN: "https://e.example/x" }, { UBC_ENGINE_ORIGIN: "https://e.example; script-src *" }, { UBC_TENANT_ID: "x" }]) assert.throws(() => deploymentConfig(bad));
});
