import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const [mode, ...args] = process.argv.slice(2);

function valueFor(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
  return value;
}

function hasValue(name) {
  return args.includes(`--${name}`);
}

function valuesFor(name) {
  const flag = `--${name}`;
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    values.push(value);
  }
  return values;
}

function validateHex(value, name) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} must be a six-digit hex color.`);
  return value.toLowerCase();
}

function hexToRgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function validateChoice(value, name, choices) {
  if (!choices.includes(value)) throw new Error(`${name} must be one of: ${choices.join(", ")}.`);
  return value;
}

function validateUnit(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be a number from 0 to 1.`);
  }
  return parsed;
}

function validateText(value, name, maxLength, fallback) {
  if (/\p{Cc}|\u2028|\u2029/u.test(value)) {
    throw new Error(`${name} must be a single line without control characters.`);
  }
  const normalized = value.trim();
  return Array.from(normalized).slice(0, maxLength).join("") || fallback;
}

function assertContainedPath(rootPath, candidatePath, label) {
  const relative = path.relative(rootPath, candidatePath);
  if (
    relative === ""
    || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  ) return;
  throw new Error(`${label} must stay inside the output directory.`);
}

async function atomicWrite(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, value, { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, file);
    await fs.chmod(file, 0o600);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

const outputDir = path.resolve(valueFor("output-dir", path.join(root, "assets")));
const themePath = path.join(outputDir, "theme.json");

function isContainedPath(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === ""
    || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
}

if (mode === "reset-demo") {
  const realRoot = await fs.realpath(root);
  const realOutput = await fs.realpath(outputDir).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (isContainedPath(root, outputDir) || (realOutput && isContainedPath(realRoot, realOutput))) {
    throw new Error("Refusing to delete project files; pass a user --output-dir.");
  }
  await fs.rm(outputDir, { recursive: true, force: true });
  console.log("Restored the bundled abstract demo preset.");
  process.exit(0);
}

if (mode !== "custom") {
  throw new Error("Usage: write-theme.mjs custom [options] | reset-demo --output-dir <dir>");
}

const requestedImage = valueFor("image", "background.jpg");
const image = path.basename(requestedImage);
if (/\p{Cc}|\u2028|\u2029/u.test(image)) {
  throw new Error("image must be a single-line filename without control characters.");
}
if (image !== requestedImage || image === "." || image === "..") {
  throw new Error("image must be a filename inside the output directory.");
}
if (!/\.(?:png|jpe?g|webp)$/i.test(image)) throw new Error("image must be a PNG, JPEG, or WebP filename.");
const canonicalOutputDir = await fs.realpath(outputDir);
const imagePath = await fs.realpath(path.join(canonicalOutputDir, image));
assertContainedPath(canonicalOutputDir, imagePath, "image");
const imageStat = await fs.stat(imagePath);
if (!imageStat.isFile() || imageStat.size < 1 || imageStat.size > 16 * 1024 * 1024) {
  throw new Error("The prepared theme image must be non-empty and no larger than 16 MB.");
}

const name = validateText(valueFor("name", "我的 Codex Dream Skin"), "name", 80, "我的 Codex Dream Skin");
const tagline = validateText(
  valueFor("tagline", "把喜欢的画面变成可交互的 Codex 工作台。"),
  "tagline",
  160,
  "把喜欢的画面变成可交互的 Codex 工作台。",
);
const quote = validateText(
  valueFor("quote", "MAKE SOMETHING WONDERFUL"),
  "quote",
  80,
  "MAKE SOMETHING WONDERFUL",
);
const appearance = validateChoice(valueFor("appearance", "auto"), "appearance", ["auto", "light", "dark"]);
const safeArea = validateChoice(valueFor("safe-area", "auto"), "safe-area", ["auto", "left", "right", "center", "none"]);
const taskMode = validateChoice(valueFor("task-mode", "auto"), "task-mode", ["auto", "ambient", "banner", "off"]);
const focusX = hasValue("focus-x") ? validateUnit(valueFor("focus-x"), "focus-x") : null;
const focusY = hasValue("focus-y") ? validateUnit(valueFor("focus-y"), "focus-y") : null;
const premiumRequested = [
  "eyebrow", "title", "decoration-profile", "motion-profile",
  "home-intensity", "task-intensity", "decoration",
].some(hasValue);

const explicitColors = {};
if (hasValue("accent")) {
  explicitColors.accent = validateHex(valueFor("accent"), "accent");
  explicitColors.accentAlt = explicitColors.accent;
  explicitColors.line = hexToRgba(explicitColors.accent, 0.32);
}
if (hasValue("secondary")) explicitColors.secondary = validateHex(valueFor("secondary"), "secondary");
if (hasValue("highlight")) explicitColors.highlight = validateHex(valueFor("highlight"), "highlight");

const custom = {
  schemaVersion: 1,
  id: `custom-${Date.now()}`,
  name: name || "我的 Codex Dream Skin",
  brandSubtitle: "CODEX DREAM SKIN",
  tagline: tagline || "把喜欢的画面变成可交互的 Codex 工作台。",
  projectPrefix: "选择项目 · ",
  projectLabel: "◉  选择项目",
  statusText: "DREAM SKIN ONLINE",
  quote: quote || "MAKE SOMETHING WONDERFUL",
  image,
  appearance,
  art: {
    safeArea,
    taskMode,
  },
};

if (focusX !== null) custom.art.focusX = focusX;
if (focusY !== null) custom.art.focusY = focusY;
if (Object.keys(explicitColors).length) custom.colors = explicitColors;

if (premiumRequested) {
  const eyebrow = validateText(valueFor("eyebrow", ""), "eyebrow", 100, "");
  const title = validateText(valueFor("title", ""), "title", 120, "");
  const decorationProfile = validateChoice(
    valueFor("decoration-profile", "none"),
    "decoration-profile",
    ["none", "postal-balanced"],
  );
  const motionProfile = validateChoice(
    valueFor("motion-profile", "none"),
    "motion-profile",
    ["none", "expressive"],
  );
  const homeIntensity = validateUnit(valueFor("home-intensity", "0"), "home-intensity");
  const taskIntensity = validateUnit(valueFor("task-intensity", "0"), "task-intensity");
  const decorationSpecs = valuesFor("decoration");
  if (decorationSpecs.length > 12) {
    throw new Error("decoration may be repeated at most 12 times.");
  }
  const ids = new Set();
  let decorationBytes = 0;
  const decorationAssets = [];
  for (const spec of decorationSpecs) {
    const parts = spec.split(":");
    if (parts.length !== 3) {
      throw new Error("decoration must use id:kind:file.");
    }
    const [id, kind, requestedFile] = parts;
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
      throw new Error("decoration id must contain only letters, numbers, underscores, or hyphens.");
    }
    if (ids.has(id)) throw new Error(`Duplicate decoration id: ${id}.`);
    ids.add(id);
    validateChoice(kind, "decoration kind", ["stamp", "portrait", "ornament", "texture"]);
    const file = path.basename(requestedFile);
    if (
      file !== requestedFile
      || file === "."
      || file === ".."
      || !/\.(?:png|jpe?g|webp)$/i.test(file)
    ) {
      throw new Error("decoration file must be a PNG, JPEG, or WebP filename inside the output directory.");
    }
    const assetPath = await fs.realpath(path.join(canonicalOutputDir, file));
    assertContainedPath(canonicalOutputDir, assetPath, `decoration ${id}`);
    const stat = await fs.stat(assetPath);
    if (!stat.isFile() || stat.size < 1 || stat.size > 4 * 1024 * 1024) {
      throw new Error(`decoration ${id} must be non-empty and no larger than 4 MB.`);
    }
    decorationBytes += stat.size;
    if (decorationBytes > 4 * 1024 * 1024) {
      throw new Error("Decorations must be no larger than 4 MB in total.");
    }
    decorationAssets.push({ id, file, kind });
  }
  custom.schemaVersion = 2;
  custom.copy = { eyebrow, title, tagline };
  custom.decorations = { profile: decorationProfile, assets: decorationAssets };
  custom.motion = { profile: motionProfile, homeIntensity, taskIntensity };
}

await atomicWrite(themePath, `${JSON.stringify(custom, null, 2)}\n`);
console.log(`Saved custom theme “${custom.name}”.`);
