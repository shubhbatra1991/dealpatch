"use client";

import { FiClock, FiCloud, FiMoon, FiSun, FiSunset } from "react-icons/fi";
import { useEffect, useState } from "react";
import { nextThemeBoundary, parseThemePreference, readThemePreference, resolveTheme, themeModes, themeStorageKey, writeThemePreference, type ThemeMode, type ThemePreference } from "../../lib/theme/theme";

const label = (mode: string) => mode.charAt(0).toUpperCase() + mode.slice(1);

export function ThemeControl() {
  // Identical SSR/client markup; bootstrap owns only the html attribute before hydration.
  const [preference, setPreference] = useState<ThemePreference>("auto");
  const [resolved, setResolved] = useState<ThemeMode | null>(null);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let current: ThemePreference = "auto";
    const apply = () => {
      clearTimeout(timer);
      const now = new Date();
      const mode = resolveTheme(current, now);
      document.documentElement.dataset.theme = mode;
      setResolved(mode);
      if (current === "auto") timer = setTimeout(apply, nextThemeBoundary(now));
    };
    const load = () => {
      try { current = readThemePreference(window.localStorage); } catch { current = "auto"; }
      setPreference(current);
      apply();
    };
    const change = (event: Event) => {
      current = parseThemePreference((event as CustomEvent<ThemePreference>).detail);
      setPreference(current);
      apply();
    };
    const storage = (event: StorageEvent) => { if (event.key === themeStorageKey || event.key === null) load(); };
    const resume = () => { if (!document.hidden) apply(); };
    load();
    window.addEventListener("dealpatch-theme", change);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("dealpatch-theme", change);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  const ThemeIcon = preference === "auto" ? FiClock : ({ morning: FiSun, afternoon: FiCloud, evening: FiSunset, night: FiMoon })[preference];

  return <div className="flex shrink-0 items-center gap-1">
    <label htmlFor="workspace-theme" className="sr-only text-[11px] text-text-muted sm:not-sr-only"><ThemeIcon aria-hidden="true" className="mr-1 inline size-3" />Theme</label>
    <select id="workspace-theme" value={preference} onChange={event => {
      const next = parseThemePreference(event.target.value);
      let saved = false;
      try { saved = writeThemePreference(window.localStorage, next); } catch {}
      setStorageError(!saved);
      window.dispatchEvent(new CustomEvent("dealpatch-theme", { detail: next }));
    }} className="h-8 w-36 rounded-sm border border-border-strong bg-surface px-1 text-[11px] text-text sm:w-40">
      <option value="auto">Automatic{resolved ? ` · ${label(resolved)}` : ""}</option>
      {themeModes.map(mode => <option key={mode} value={mode}>{label(mode)}</option>)}
    </select>
    <span role="status" className="sr-only">{storageError ? "Theme changed for this session. Browser storage is unavailable; preference could not be saved." : ""}</span>
  </div>;
}
