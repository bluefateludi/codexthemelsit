import path from "node:path";

const CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
const IMAGE_PATTERN = /\.(?:png|jpe?g|webp)$/i;
const DECORATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const DECORATION_KINDS = ["stamp", "portrait", "ornament", "texture"];
const DECORATION_PROFILES = ["none", "postal-balanced"];
const MOTION_PROFILES = ["none", "expressive"];
const MAX_DECORATIONS = 12;

function text(value, fallback, max, name, configPath) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || CONTROL_PATTERN.test(value)) {
    throw new Error(`${configPath} has an invalid ${name} field`);
  }
  const normalized = value.trim();
  return normalized ? Array.from(normalized).slice(0, max).join("") : fallback;
}

function color(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) || /^rgba?\([0-9., %]+\)$/i.test(normalized)
    ? normalized
    : fallback;
}

function choice(value, name, choices, configPath, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !choices.includes(value)) {
    throw new Error(`${configPath} has an invalid ${name} field`);
  }
  return value;
}

function unit(value, name, configPath, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${configPath} has an invalid ${name} field`);
  }
  return value;
}

function object(value, name, configPath) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${configPath} has an invalid ${name} field`);
  }
  return value;
}

function filename(value, name, configPath) {
  if (typeof value !== "string" || !value || CONTROL_PATTERN.test(value)) {
    throw new Error(`${configPath} has an invalid ${name} field`);
  }
  if (
    path.basename(value) !== value
    || value === "."
    || value === ".."
    || !IMAGE_PATTERN.test(value)
  ) {
    if (name === "image" && path.basename(value) !== value) {
      throw new Error("Theme image must stay inside its theme directory");
    }
    throw new Error(`${configPath} has an invalid ${name} field`);
  }
  return value;
}

function normalizeCommonFields(raw, configPath) {
  const rawColors = raw.colors && typeof raw.colors === "object" && !Array.isArray(raw.colors)
    ? raw.colors : null;
  const colorKeys = [
    "background", "panel", "panelAlt", "accent", "accentAlt", "secondary",
    "highlight", "text", "muted", "line",
  ];
  const appearance = choice(
    raw.appearance,
    "appearance",
    ["auto", "light", "dark"],
    configPath,
  );
  const rawArt = object(raw.art, "art", configPath);
  const art = {
    focusX: unit(rawArt.focusX, "art.focusX", configPath),
    focusY: unit(rawArt.focusY, "art.focusY", configPath),
    safeArea: choice(
      rawArt.safeArea,
      "art.safeArea",
      ["auto", "left", "right", "center", "none"],
      configPath,
    ),
    taskMode: choice(
      rawArt.taskMode,
      "art.taskMode",
      ["auto", "ambient", "banner", "off"],
      configPath,
    ),
  };
  const theme = {
    id: text(raw.id, "custom", 80, "id", configPath),
    name: text(raw.name, "Codex Dream Skin", 80, "name", configPath),
    brandSubtitle: text(
      raw.brandSubtitle,
      "CODEX DREAM SKIN",
      80,
      "brandSubtitle",
      configPath,
    ),
    tagline: text(
      raw.tagline,
      "Make something wonderful.",
      160,
      "tagline",
      configPath,
    ),
    projectPrefix: text(raw.projectPrefix, "选择项目 · ", 80, "projectPrefix", configPath),
    projectLabel: text(raw.projectLabel, "◉  选择项目", 80, "projectLabel", configPath),
    statusText: text(raw.statusText, "DREAM SKIN ONLINE", 80, "statusText", configPath),
    quote: text(raw.quote, "MAKE SOMETHING WONDERFUL", 80, "quote", configPath),
    colorMode: rawColors ? "explicit" : "auto",
    explicitColorKeys: rawColors ? colorKeys.filter((key) => Object.hasOwn(rawColors, key)) : [],
    colors: {
      background: color(rawColors?.background, "#071116"),
      panel: color(rawColors?.panel, "#0b1a20"),
      panelAlt: color(rawColors?.panelAlt, "#10272c"),
      accent: color(rawColors?.accent, "#7cff46"),
      accentAlt: color(rawColors?.accentAlt, "#b8ff3d"),
      secondary: color(rawColors?.secondary, "#36d7e8"),
      highlight: color(rawColors?.highlight, "#642a8c"),
      text: color(rawColors?.text, "#e9fff1"),
      muted: color(rawColors?.muted, "#9ebdb3"),
      line: color(rawColors?.line, "rgba(124, 255, 70, .28)"),
    },
  };
  if (appearance !== undefined) theme.appearance = appearance;
  if (Object.values(art).some((value) => value !== undefined)) {
    theme.art = Object.fromEntries(
      Object.entries(art).filter(([, value]) => value !== undefined),
    );
  }
  return theme;
}

function normalizeCopy(value, configPath, fallbackTagline) {
  const raw = object(value, "copy", configPath);
  return {
    eyebrow: text(raw.eyebrow, "", 100, "copy.eyebrow", configPath),
    title: text(raw.title, "", 120, "copy.title", configPath),
    tagline: text(raw.tagline, fallbackTagline, 160, "copy.tagline", configPath),
  };
}

function normalizeDecorations(value, configPath) {
  const raw = object(value, "decorations", configPath);
  const profile = choice(
    raw.profile,
    "decorations.profile",
    DECORATION_PROFILES,
    configPath,
    "none",
  );
  const entries = raw.assets ?? [];
  if (!Array.isArray(entries)) {
    throw new Error(`${configPath} has an invalid decorations.assets field`);
  }
  if (entries.length > MAX_DECORATIONS) {
    throw new Error(`${configPath} decorations.assets may contain at most ${MAX_DECORATIONS} entries`);
  }
  const ids = new Set();
  const assets = entries.map((entry, index) => {
    const label = `decorations.assets[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${configPath} has an invalid ${label} field`);
    }
    if (typeof entry.id !== "string" || !DECORATION_ID_PATTERN.test(entry.id)) {
      throw new Error(`${configPath} has an invalid ${label}.id field`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`${configPath} has a duplicate ${label}.id field`);
    }
    ids.add(entry.id);
    return {
      id: entry.id,
      file: filename(entry.file, `${label}.file`, configPath),
      kind: choice(entry.kind, `${label}.kind`, DECORATION_KINDS, configPath),
    };
  });
  return { profile, assets };
}

function normalizeMotion(value, configPath) {
  const raw = object(value, "motion", configPath);
  return {
    profile: choice(
      raw.profile,
      "motion.profile",
      MOTION_PROFILES,
      configPath,
      "none",
    ),
    homeIntensity: unit(raw.homeIntensity, "motion.homeIntensity", configPath, 0),
    taskIntensity: unit(raw.taskIntensity, "motion.taskIntensity", configPath, 0),
  };
}

export function normalizeThemeConfig(raw, { configPath = "theme.json" } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${configPath} must contain a JSON object`);
  }
  if (![1, 2].includes(raw.schemaVersion)) {
    throw new Error(`${configPath} has an unsupported schema`);
  }
  const image = filename(raw.image, "image", configPath);
  const theme = normalizeCommonFields(raw, configPath);
  theme.schemaVersion = raw.schemaVersion;
  theme.image = image;
  const assetNames = [image];

  if (raw.schemaVersion === 2) {
    theme.copy = normalizeCopy(raw.copy, configPath, theme.tagline);
    theme.decorations = normalizeDecorations(raw.decorations, configPath);
    theme.motion = normalizeMotion(raw.motion, configPath);
    for (const asset of theme.decorations.assets) {
      if (!assetNames.includes(asset.file)) assetNames.push(asset.file);
    }
  }

  return { theme, assetNames };
}
