import assert from "node:assert/strict";
import { normalizeThemeConfig } from "../scripts/theme-schema.mjs";

const v1 = normalizeThemeConfig({
  schemaVersion: 1,
  id: "legacy",
  name: "Legacy",
  image: "background.jpg",
}, { configPath: "fixture/theme.json" });
assert.equal(v1.theme.schemaVersion, 1);
assert.deepEqual(v1.assetNames, ["background.jpg"]);

const v2 = normalizeThemeConfig({
  schemaVersion: 2,
  id: "custom-violet-postal",
  name: "紫罗兰 · 邮政事务所",
  image: "background.jpg",
  copy: {
    eyebrow: "CH POSTAL COMPANY · WORKBENCH",
    title: "今天，要写下怎样的心意？",
    tagline: "让每一次编码，都像一封被认真书写的信。",
  },
  decorations: {
    profile: "postal-balanced",
    assets: [{ id: "portrait", file: "portrait.png", kind: "stamp" }],
  },
  motion: { profile: "expressive", homeIntensity: 1, taskIntensity: 0.25 },
}, { configPath: "fixture/theme.json" });
assert.equal(v2.theme.decorations.profile, "postal-balanced");
assert.deepEqual(v2.assetNames, ["background.jpg", "portrait.png"]);
assert.equal(v2.theme.motion.taskIntensity, 0.25);
assert.equal(v2.theme.copy.title, "今天，要写下怎样的心意？");

assert.throws(() => normalizeThemeConfig({
  schemaVersion: 2,
  image: "background.jpg",
  decorations: { assets: [{ id: "x", file: "../escape.png", kind: "stamp" }] },
}, { configPath: "fixture/theme.json" }), /decorations\.assets\[0\]\.file/);

assert.throws(() => normalizeThemeConfig({
  schemaVersion: 2,
  image: "background.jpg",
  decorations: {
    assets: Array.from({ length: 13 }, (_, index) => ({
      id: `asset-${index}`,
      file: `asset-${index}.png`,
      kind: "ornament",
    })),
  },
}, { configPath: "fixture/theme.json" }), /at most 12/);

assert.throws(() => normalizeThemeConfig({
  schemaVersion: 2,
  image: "background.jpg",
  motion: { profile: "expressive", homeIntensity: 1.01, taskIntensity: 0.25 },
}, { configPath: "fixture/theme.json" }), /motion\.homeIntensity/);

console.log("PASS: theme schema v1/v2 normalization and validation.");
