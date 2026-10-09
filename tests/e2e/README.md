# Review Queue browser validation

Install dependencies with `npm install`, then install the test browser once:

```sh
npx playwright install chromium
npm run build
npx playwright test
```

`npm run test:e2e` is an alias for the last command. Playwright starts and stops
the production server on port 3100. It intentionally refuses to reuse a server,
so a developer's running workspace is never reset. Run the build before tests;
the suite does not rebuild or run against a potentially stale development server.

Each test receives an isolated Chromium context. The fixture clears every native
IndexedDB table and reloads to exercise the application's normal seed initializer.
No repository, query, simulation, or IndexedDB implementation is mocked.

The golden path removes only `proposal_001` during setup, allowing the original
fictional `activity_003` to generate a fresh proposal through the real simulator.
Conflict tests modify the seeded deal through native IndexedDB to represent a
second local writer. Assertions use visible UI behavior rather than stored data.
The storage-abort test temporarily intercepts the first native audit insert and
aborts its real transaction. This is the only fault injection; it verifies atomic
rollback after the entity write and restores the native method before retrying.

The suite covers approval, partial approval, edited values and validation,
rejection, stale detection, atomic rollback after a concurrent edit, safe Undo,
Undo conflicts, pending badges, reload persistence, Deal Detail/audit navigation,
keyboard movement, focus restoration, and shortcuts while typing. The golden
path also checks duplicate protection when returning to the source activity.

Failure traces/screenshots and the HTML report are ignored generated artifacts.
Inspect with `npx playwright show-report`. Tests run without retries so failures
are visible instead of hidden. Chromium is the initial browser target; this is
not a claim of Firefox, WebKit, or assistive technology certification.

## Validation recorded 9 October 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 131 passed |
| `npm run build` | Passed |
| `npx playwright test` | 11 passed, no retries |

Manual browser checks on a separate production origin verified visible focus,
Arrow/J navigation, Enter/Escape dialog behavior and restored focus, A/R review
shortcuts, invalid edits, partial/full/rejected status transitions, immediate
badge changes, and Undo. Captured conflict and rollback screens were also
manually inspected: captured 20%, current 35%, proposed 45%, disabled unsafe
approval, and the explicit rollback notification were visible and readable.

No functional application bugs were found or runtime code changed in this task.
An initial lint failure was a fixture callback named `use` being mistaken for a
React hook; renaming the callback fixed it without suppressing lint rules.
The singular "1 changes" copy issue recorded here was corrected in the following
performance-hardening milestone; see `docs/PERFORMANCE.md` for that validation.

Remaining limits: browser coverage is Chromium only; Undo receipts remain
session-scoped (the persistence assertions cover CRM values, proposals and audit
history, not Undo surviving reload). Installation audit reported five high
severity findings in the existing `eslint-config-next` / `fast-glob` /
`micromatch` / `braces` development dependency chain. No Playwright advisory was
reported. No forced downgrade or unrelated dependency changes were made.

## Public showcase and workspace routes

Workspace tests use `/workspace` and its descendants. `landing.spec.ts` checks no
IndexedDB is created before workspace entry, shared theme persistence, browser
back behavior, metadata and configured links. Four-mode desktop/mobile screenshot
baselines and axe scans cover the showcase. Workspace baselines stay unchanged.

Landing reflow checks cover 1920, 1280, 768, 390 and 320px. Reduced-motion and
forced-color focus checks are separate from normal-palette contrast scans: axe's
authored-color calculation does not model forced system paints. No contrast rules
are disabled in the four-theme desktop/mobile scans. Native screen-reader and
cross-platform screenshot limitations remain documented in ACCESSIBILITY.md.

Landing/route migration validation (9 October 2026): typecheck, lint, 148 unit
tests, production build and all 50 Playwright tests pass. The seven added browser
cases cover four-mode visuals/axe, metadata/project links, isolated landing entry,
Automatic/manual themes, keyboard/reflow, and migrated Favorites/Saved Views/Search.
Eight new landing baselines and all 26 unchanged workspace baselines pass comparison.
The existing real IndexedDB golden path, rollback, stale/unsafe Undo and large-data
structural checks also pass under `/workspace`.

## Open-source release checks

Install engines once with `npx playwright install chromium firefox webkit`. The
full `npm run test:e2e` gate includes the existing Chromium suites and four release
smoke tests in each of Chromium, Firefox and WebKit. `npx playwright test
release.spec.ts` runs just those twelve checks. Earlier results above are milestone
history; see [the current release report](../../docs/RELEASE_READINESS.md).

Release checks start with genuinely fresh browser contexts. They cover landing
entry, seeding, themes, favorites/saved-view persistence, global search, simulated
analysis, real proposal approval/audit persistence, reset, malformed records,
missing relationships, invalid IDs and unavailable IndexedDB. Normal-use checks
fail on console errors/warnings, page errors, unexpected failed responses and
third-party requests. Intentional failure scenarios are tested separately.

Global setup bundles the actual reset module into ignored `node_modules/.cache`
using Next's bundled webpack and the installed TypeScript compiler. A Playwright
route serves it only within reset tests; no application route or debug endpoint is
added. Native IndexedDB fixture writes simulate corruption or another writer;
workflow assertions use visible UI and real persistence. Reset checks assert all
eight store counts and the restored deal value.

Firefox/WebKit are smoke targets, not complete platform or assistive-technology
certification. Screenshot and axe suites remain Chromium-based.

Release-hardening final gate (9 October 2026): standalone clean-install typecheck,
lint (zero warnings), 149 unit tests and production build passed. All 62 production
Playwright tests passed with no retries: 54 Chromium, four Firefox and four WebKit,
including the 22 workspace accessibility cases, 34 unchanged screenshot baselines
and stress fixture. Three additional repeated Firefox workflow checks passed after
replacing forced reload-style navigation with normal product links; console warning
assertions remain strict. No application feature or dependency was added.

## Landing interaction polish

`landing-motion.spec.ts` tests the scripted hero sequence/replay, retained stage
time on hover/focus/manual pause, document visibility and viewport pause/resume,
static/live preference changes for reduced motion, once-only workflow/reveal,
keyboard product tabs, all-theme axe and forced-colors focus. Document visibility
is changed with an isolated browser-property fixture; UI and timers remain real.
The clock advances one stage at a time so React commits between timer callbacks.

The four-theme desktop/mobile landing snapshots deliberately use reduced motion:
all content is visible and the complete hero state is deterministic. These eight
baselines are updated for the new showcase/status surface; workspace baselines
are unchanged. README's landing image uses the same completed static capture.
Looping hero text has no live region, and no workspace data is touched. Native
screen-reader testing remains a separate manual limitation.

Landing-polish final gate (9 October 2026): typecheck, lint (zero warnings),
150 unit tests and production build passed. All 68 Playwright tests passed without
retries: 60 Chromium, four Firefox and four WebKit. The eight landing baselines
were intentionally updated; all 26 workspace baselines passed unchanged.

## Landing sections and footer

The lower-section check scrolls through workflow, product, human review,
local-first, engineering and open-source sections at desktop/mobile widths.
It verifies the four review principles, seven engineering highlights, CTA tab
order, footer links/technology labels and visible keyboard focus. Existing
four-theme screenshot/axe, 320px reflow and reduced-motion tests remain in place.
Eight landing baselines were refreshed for the added engineering grid, expanded
review explanation, open-source actions and footer; the hero was preserved.

Final validation: typecheck, lint, 150 unit tests and production build passed.
All 69 end-to-end tests passed without retries (61 Chromium, four Firefox, four
WebKit), including all four landing themes, axe scans and unchanged workspace
visual comparisons.

The scrolling regression uses actual mouse-wheel input and Home/End keys at
desktop and mobile widths. Programmatic `scrollIntoView` alone can still move a
document with `overflow: hidden`, so section-reachability checks do not replace
this user-input test. Document scrolling is allowed globally; the workspace's
viewport-height shell retains its own internal scroll container.
