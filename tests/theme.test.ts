import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { nextThemeBoundary, parseThemePreference, readThemePreference, resolveTheme, resolveThemeForTime, themeStorageKey, writeThemePreference } from "../lib/theme/theme";

const boundaries = [[4, 59, "night"], [5, 0, "morning"], [11, 59, "morning"], [12, 0, "afternoon"], [16, 59, "afternoon"], [17, 0, "evening"], [20, 59, "evening"], [21, 0, "night"]] as const;
for (const [hour, minute, mode] of boundaries) test(`local theme boundary ${hour}:${minute} resolves ${mode}`, () => {
  const date = new Date(2026, 9, 9, hour, minute);
  assert.equal(resolveThemeForTime(date), mode);
  assert.equal(resolveTheme("auto", date), mode);
  assert.equal(nextThemeBoundary(date), minute === 59 ? 60_000 : (hour === 5 ? 7 : hour === 12 ? 5 : hour === 17 ? 4 : 8) * 3_600_000);
});

test("manual override persists only preference, reloads and switches back to auto", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const morning = new Date(2026, 9, 9, 7);
  assert.equal(readThemePreference(storage), "auto");
  assert.equal(writeThemePreference(storage, "night"), true);
  assert.equal(resolveTheme(readThemePreference(storage), morning), "night");
  assert.equal(values.get(themeStorageKey), "night");
  writeThemePreference(storage, "auto");
  assert.equal(values.get(themeStorageKey), "auto");
  assert.equal(resolveTheme(readThemePreference(storage), morning), "morning");
  assert.equal(parseThemePreference("unexpected"), "auto");
  assert.equal(parseThemePreference({ theme: "night" }), "auto");
  assert.equal(readThemePreference({ getItem: () => { throw new Error("Blocked"); } }), "auto");
  assert.equal(writeThemePreference({ setItem: () => { throw new Error("Blocked"); } }, "night"), false);
});

test("pre-paint bootstrap matches the pure resolver and tolerates blocked or invalid storage", () => {
  const script = readFileSync(resolve(process.cwd(), "../../../public/theme-init.js"), "utf8");
  for (const [hour, minute] of boundaries) {
    const date = new Date(2026, 9, 9, hour, minute);
    for (const preference of ["auto", "morning", "afternoon", "evening", "night", "invalid", null]) {
      const root = { dataset: { theme: "" } };
      runInNewContext(script, { document: { documentElement: root }, localStorage: { getItem: () => preference }, Date: class extends Date { constructor() { super(date); } } });
      assert.equal(root.dataset.theme, resolveTheme(parseThemePreference(preference), date));
    }
  }
  const root = { dataset: { theme: "" } };
  runInNewContext(script, { document: { documentElement: root }, localStorage: { getItem: () => { throw new Error("Blocked"); } }, Date });
  assert.match(root.dataset.theme, /^(morning|afternoon|evening|night)$/);
});

test("every palette keeps semantic text, status, buttons and focus contrast", () => {
  const css = readFileSync(resolve(process.cwd(), "../../../app/globals.css"), "utf8");
  const luminance = (hex: string) => {
    const linear = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  for (const mode of ["morning", "afternoon", "evening", "night"]) {
    const block = css.match(new RegExp(`\\[data-theme="${mode}"\\]\\s*\\{([^}]+)\\}`))![1];
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map(match => [match[1], match[2]]));
    const check = (foreground: string, background: string, minimum = 4.5) => {
      const [a, b] = [luminance(tokens[foreground]), luminance(tokens[background])].sort((a, b) => b - a);
      assert.ok((a + 0.05) / (b + 0.05) >= minimum, `${mode}: ${foreground} on ${background} needs ${minimum}:1`);
    };
    for (const background of ["bg", "bg-subtle", "surface", "surface-raised", "surface-muted", "accent-soft"]) {
      for (const foreground of ["text", "text-muted", "text-subtle", "accent"]) check(foreground, background);
      check("focus-ring", background, 3);
    }
    for (const status of ["success", "warning", "danger"]) {
      check(status, `${status}-soft`);
      check(status, "surface");
    }
    check("on-accent", "accent");
    check("on-accent", "accent-hover");
    check("border-strong", "surface", 3);
  }
});
