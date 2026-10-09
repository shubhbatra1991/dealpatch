export const themeModes = ["morning", "afternoon", "evening", "night"] as const;
export type ThemeMode = typeof themeModes[number];
export type ThemePreference = "auto" | ThemeMode;
export const themeStorageKey = "dealpatch.theme";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "auto" || themeModes.some(mode => mode === value) ? value as ThemePreference : "auto";
}

export function resolveThemeForTime(date: Date): ThemeMode {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function resolveTheme(preference: ThemePreference, date: Date): ThemeMode {
  return preference === "auto" ? resolveThemeForTime(date) : preference;
}

export function nextThemeBoundary(date: Date): number {
  const next = new Date(date);
  const hour = [5, 12, 17, 21].find(hour => hour > date.getHours());
  if (hour === undefined) next.setDate(next.getDate() + 1);
  next.setHours(hour ?? 5, 0, 0, 0);
  return Math.max(1, next.getTime() - date.getTime());
}

export function readThemePreference(storage: Pick<Storage, "getItem">): ThemePreference {
  try { return parseThemePreference(storage.getItem(themeStorageKey)); } catch { return "auto"; }
}

export function writeThemePreference(storage: Pick<Storage, "setItem">, preference: ThemePreference): boolean {
  try { storage.setItem(themeStorageKey, preference); return true; } catch { return false; }
}
