# DealPatch theme architecture

Themes change semantic colors, not layout, typography, spacing, components or
data behavior. No package was added for this milestone.

## Modes and local time

The preference is `auto | morning | afternoon | evening | night`. The pure
`lib/theme/theme.ts` resolver uses the supplied Date's **local** hour:

| Mode | Local time | Character |
| --- | --- | --- |
| Morning | 05:00–11:59 | Warm, bright, restrained |
| Afternoon | 12:00–16:59 | Neutral, crisp light |
| Evening | 17:00–20:59 | Warm dim surfaces |
| Night | 21:00–04:59 | Dark blue-gray, high contrast |

Automatic mode schedules the next local boundary and recalculates when the tab
becomes visible or the window receives focus. Background timer throttling is
handled by that resume check. Manual modes never change with time. This is
device time, not account region, server time, sunrise or OS color preference.

## Semantic tokens

`app/globals.css` defines the four palettes once. Tailwind 4 `@theme inline`
exposes their variables as semantic utilities; components contain no mode
branches or palette-specific color names.

| Variables | Role |
| --- | --- |
| `--bg`, `--bg-subtle` | Workspace and subtle secondary backgrounds |
| `--surface`, `--surface-raised`, `--surface-muted` | Panels, dialogs, muted surfaces |
| `--border`, `--border-strong` | Dividers and stronger control boundaries |
| `--text`, `--text-muted`, `--text-subtle` | Text hierarchy, including secondary metadata |
| `--accent`, `--accent-hover`, `--accent-soft` | Links, primary actions, selected/proposed surfaces |
| `--on-accent` | Primary action text, including dark text on light dark-mode accents |
| `--success`, `--warning`, `--danger`, `--info` | Semantic status colors |
| `--success-soft`, `--warning-soft`, `--danger-soft` | Status surfaces |
| `--success-border`, `--warning-border`, `--danger-border` | Status boundaries |
| `--focus-ring` | Keyboard focus and native checkbox/meter accent |
| `--shadow`, `--overlay` | Restrained elevation and modal backdrop |

Examples: `bg-surface`, `text-text-muted`, `border-border-strong`,
`bg-accent-soft`, `text-warning`, `outline-focus-ring`. Transparent variants
still blend semantic colors. Native inputs and selects follow `color-scheme`
and semantic foreground/background rules. Existing shadows use the shadow token.

## Control and persistence

The shell includes a native select labeled **Theme**, supporting keyboard
selection. Automatic's option displays its current resolved mode. The shell
geometry only makes room for this compact control; navigation is unchanged.

The small UI preference is persisted in localStorage under `dealpatch.theme`.
This is an intentional exception to IndexedDB for CRM records: it allows
synchronous pre-paint access without waiting for an asynchronous database.
It contains only a validated theme preference, never CRM data or secrets.
Automatic stores `auto`, not its resolved mode. Cross-tab storage events sync
the control and theme. Invalid/missing preferences fall back to automatic.
Blocked writes retain the selected mode for the current session and announce
that persistence is unavailable. Clearing browser storage resets to automatic.

No theme preference is stored in Zustand, Query caches or domain entities.

## Initial render and hydration

The root layout loads the first-party `/theme-init.js` as a synchronous classic
script in the head. It validates localStorage and applies `data-theme` before
the body paints, including when React bundles have not loaded. This avoids
`dangerouslySetInnerHTML`, inline executable strings, cookies and server-side
device-time guesses. The root html element alone suppresses the expected
hydration warning for the pre-paint attribute. Component markup starts with
the same neutral control value on the server and first client render, then
loads the actual preference; no hydration error is expected or suppressed in
the rest of the application.

Tradeoff: the small same-origin script is parser-blocking and adds a resource
request before rendering. If scripts are disabled or the bootstrap fails,
the CSS fallback is Afternoon until hydration can resolve a mode. With all
JavaScript disabled the existing IndexedDB application is not interactive.
The bootstrap duplicates only the small validator/time-range calculation;
unit tests assert parity against the typed resolver at every requested boundary.
Future CSP work must allow this same-origin asset as well as Next's runtime.

## Accessibility

Text labels, icons, pressed/selected states, boundaries and diff structure
remain primary. Current/proposed values are explicitly named. Stale diffs
retain original/current/proposed values and approval-blocked messaging;
applied, rejected, skipped and edited statuses retain their text.

Each palette tests text at 4.5:1 on core surfaces, status text on its surface,
primary button text against normal/hover backgrounds, focus at 3:1 and strong
control boundaries at 3:1 on the main surface. Disabled controls retain readable
text and use their native disabled state, cursor and dashed border instead of
whole-control opacity. Reduced-motion rules and forced-colors system outlines
remain intact. Colors do not animate when time changes.

Axe checks are evidence, not a WCAG certification. Native select popups, OS high
contrast, screen-reader announcements, all hover combinations, browser zoom and
virtualized unmounted content still have the manual limitations documented in
ACCESSIBILITY.md. Test screenshots require human review; no unreliable pixel or
timing thresholds are introduced.

## Tests and validation

`tests/theme.test.ts` covers all eight requested boundary cases, boundary
scheduling, manual override, persistence, return to auto, invalid/blocked
storage, bootstrap parity and palette contrast.

`tests/e2e/theme.spec.ts` checks all four modes on Overview, Pipeline, Review
Queue and Deal Detail with axe, plus invalid review editing, stale conflicts,
rejected/applied/undone states and mobile layouts. It captures 16 main-surface
screenshots, four conflict screenshots and four mobile screenshots under the
Playwright output directory. It also tests keyboard
selection, reload persistence, automatic boundary updates, tab-resume updates,
no console errors during theme changes, and pre-paint initialization while
React bundles are blocked. The complete existing end-to-end suite continues
to cover approvals, rollback, undo, audit, search and keyboard behavior.

Final validation:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 148 tests passed, including 11 new theme tests.
- `npm run build`: passed.
- `npm run test:e2e`: 40 Chromium tests passed, including 22 existing
  accessibility tests, the stress performance test, all review workflows and
  six new theme tests. All themed axe scans reported zero violations with no
  rule exclusions. This does not resolve axe incomplete/manual checks.
- Screenshots were visually inspected across all four palettes, including
  Overview, Pipeline, Deal Detail, review conflicts and narrow-screen focus.
  The native health meter initially retained its browser fill; it now uses the
  semantic accent. The initial theme test also attempted to click behind an
  open modal; the test was corrected to close both editor and dialog first.

Browser coverage remains Chromium-only. Real screen-reader, native browser
zoom and OS high-contrast validation retain the limitations in ACCESSIBILITY.md.

## Files changed

- New: `lib/theme/theme.ts`, `public/theme-init.js`,
  `components/layout/theme-control.tsx`, `tests/theme.test.ts`,
  `tests/e2e/theme.spec.ts`, this document.
- `app/layout.tsx`: first-paint bootstrap; `app/globals.css`: palettes/utilities.
- `components/layout/app-header.tsx`: control integration.
- Existing presentation files in `components/layout`, `components/ui` and
  `features/accounts`, `activity`, `contacts`, `deals`, `favorites`, `overview`,
  `pipeline`, `reviews`, `saved-views`, `search`: mechanical replacement of
  fixed palette utilities with semantic utilities. Business logic is unchanged.
- `docs/DESIGN_SYSTEM.md`: reference to this guide; `.gitignore`: track both
  theming documents alongside the hardening documentation.

No schema migration, backend, dependency or product workflow was introduced.
