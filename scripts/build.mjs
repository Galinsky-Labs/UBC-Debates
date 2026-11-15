import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = ["index.html", "styles.css", "app.js", "contracts.js", "engine-client.js"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Only two non-secret, strictly validated values enter the bundle: the engine HTTPS origin and the
 * UBC tenant id. Nothing else from the environment is read.
 */
export function deploymentConfig(env = process.env) {
  const rawOrigin = env.UBC_ENGINE_ORIGIN?.trim() || null;
  const rawTenant = env.UBC_TENANT_ID?.trim() || null;
  let engineOrigin = null;
  if (rawOrigin) {
    const url = new URL(rawOrigin);
    if (url.origin !== rawOrigin || (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("UBC_ENGINE_ORIGIN must be an exact HTTPS origin");
    engineOrigin = rawOrigin;
  }
  if (rawTenant && !UUID.test(rawTenant)) throw new Error("UBC_TENANT_ID must be a UUID");
  return Object.freeze({ engineOrigin, tenantId: rawTenant });
}

export async function build(outputDir = resolve(root, "dist"), env = process.env) {
  const config = deploymentConfig(env);
  const contents = new Map();
  for (const name of assets) {
    const source = resolve(root, "src", name);
    if (name.endsWith(".js")) execFileSync(process.execPath, ["--check", source], { env: {}, stdio: "pipe" });
    let bytes = await readFile(source);
    if (name === "index.html") bytes = Buffer.from(bytes.toString("utf8").replace("connect-src 'none'", `connect-src ${config.engineOrigin ?? "'none'"}`));
    contents.set(name, bytes);
  }
  contents.set("config.js", Buffer.from(`/** Generated at build time. */\nexport const CONFIG = Object.freeze(${JSON.stringify(config)});\n`));
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const manifest = { version: 2, presentationContract: 2, engineApi: "public-v1", engineIntegration: config.engineOrigin && config.tenantId ? "configured" : "not-configured", assets: {} };
  for (const [name, bytes] of [...contents].sort(([a], [b]) => a.localeCompare(b))) {
    await writeFile(resolve(outputDir, name), bytes);
    manifest.assets[name] = createHash("sha256").update(bytes).digest("hex");
  }
  await writeFile(resolve(outputDir, "build-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await build();
  console.log(`Built UBC Debates (${manifest.engineIntegration}) in dist/`);
}
