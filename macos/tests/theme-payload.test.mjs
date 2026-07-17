import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const macosRoot = path.resolve(here, "..");
const injector = path.join(macosRoot, "scripts", "injector.mjs");
const fixtureAsset = path.join(macosRoot, "assets", "portal-hero.png");
const tempRoot = await fs.mkdtemp(path.join("/tmp", "codex-dream-skin-payload-"));

function checkPayload(themeDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      injector,
      "--check-payload",
      "--theme-dir",
      themeDir,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(JSON.parse(stdout));
      else reject(new Error(stderr || `injector exited with ${code}`));
    });
  });
}

try {
  const themeDir = path.join(tempRoot, "postal");
  await fs.mkdir(themeDir);
  await fs.copyFile(fixtureAsset, path.join(themeDir, "background.png"));
  await fs.copyFile(fixtureAsset, path.join(themeDir, "stamp.png"));
  await fs.writeFile(path.join(themeDir, "theme.json"), `${JSON.stringify({
    schemaVersion: 2,
    id: "custom-violet-postal",
    name: "紫罗兰 · 邮政事务所",
    image: "background.png",
    decorations: {
      profile: "postal-balanced",
      assets: [{ id: "stamp", file: "stamp.png", kind: "stamp" }],
    },
    motion: { profile: "expressive", homeIntensity: 1, taskIntensity: 0.25 },
  })}\n`);

  const payload = await checkPayload(themeDir);
  assert.equal(payload.pass, true);
  assert.equal(payload.themeSchemaVersion, 2);
  assert.equal(payload.decorationCount, 1);
  assert.ok(payload.decorationBytes > 0);
  assert.deepEqual(payload.omittedDecorations, []);

  console.log("PASS: injector loads validated decoration payloads and diagnostics.");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
