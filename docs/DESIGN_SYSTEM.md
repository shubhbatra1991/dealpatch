# DealPatch workspace design system

DealPatch is a compact, technical B2B workspace. Strong hierarchy comes from type,
alignment and surface boundaries, not oversized cards or decoration. One component
system serves all modes. See [THEMING.md](./THEMING.md) for token definitions, time
boundaries, persistence and initialization; those rules are not duplicated here.

## Public showcase layer

`/` uses `features/landing/landing.css`, scoped to `.landing`, and shares all
semantic tokens and ThemeControl with `/workspace`. No separate palette or
theme-specific component branches are introduced. A bounded 1240px canvas, larger
editorial typography and 44–88px section spacing distinguish the showcase from
the compact CRM. Borders, small radii and restrained elevation remain related.

The hero uses a scripted fictional Review Queue example; the human-review section
retains a static example. Illustrated approval labels never change CRM data. A
separate Pause control and product tabs are keyboard-operable; real work starts through
Explore workspace. The public header uses section anchors and the CRM sidebar
stays inside `/workspace`.

Preview columns stack at tablet sizes, workflow steps reflow, and narrow headers
retain the theme selector. No gradients, imagery, video or animation libraries are
added. The landing layer also uses short opacity/transform entrances, once-only
scroll reveals and staged demo transitions. Reduced motion disables these and
autoplay; forced-colors
outlines remain. Landing screenshots cover four modes on desktop/mobile.
Workspace baselines are preserved unless verified migration changes require updates.

Below the hero, the showcase follows the workflow, interactive product tabs,
human-review evidence, local-first setup, engineering highlights and open-source
invitation. Human review uses an editorial decision record, distinct from the
hero's Review Queue illustration. Pipeline previews include account, deal, stage,
risk and value; Audit includes fictional timestamps and reversal history.
Engineering highlights are a compact text grid, without statistics or commercial
claims. The footer has Product, Project and Built with columns, stacking on small
screens, followed by the educational-project label and year. These additions use
the existing one-shot reveals and semantic tokens; no new client island is needed.

Feather icons from the already installed `react-icons/fi` now serve record types,
navigation, search, favorites, back links, theme labels and landing external links.
There was no Lucide dependency to retain and no package was added. Named imports
keep one family and avoid a second library. Decorative SVGs are hidden from
assistive technology; buttons retain labels and favorite pressed/filled states.
No workspace layout, query, persistence or record behavior changes.

The landing page uses normal document scrolling. The earlier global `html`
overflow lock is absent; workspace scrolling remains scoped to its shell. Browser
regressions cover wheel input, native scrollbar dragging (headless scrollbars
explicitly enabled), PageDown, Space, End/Home and Chromium mobile touch input.
Physical trackpad and phone hardware are not covered by this emulation.

Landing finishing build observation (10 October 2026): the generated `/` HTML
references ten unique local scripts totaling 598,903 raw bytes / 184,181 summed
gzip bytes. This was measured from `.next/server/app/index.html`, reading each
referenced framework/public script and applying Node `zlib.gzipSync` individually.
It includes framework and theme bootstrap code, not just landing code, and is not
a network or latency benchmark. None of these scripts contains a Dexie marker;
browser tests also assert no IndexedDB initialization before workspace entry.
Static content remains server-rendered and the existing client islands, observer
and cancellable timer behavior are unchanged. No animation package was added.

Landing finishing validation (10 October 2026): typecheck, lint, 150 unit tests,
production build and all 73 Playwright tests pass. Production dependency audit
reports zero vulnerabilities. Four-theme desktop/mobile landing axe scans, tab and
footer keyboard paths, reduced motion, forced colors and 320–1920px reflow checks
pass. Existing real IndexedDB review, stress and Chromium/Firefox/WebKit release
flows also pass. Eight landing and 26 workspace screenshot baselines were updated
deliberately for the landing finishing and shared Feather icon changes; the
documentation landing capture was refreshed. Desktop/mobile captures were visually
reviewed. Physical trackpad/phone and real screen-reader verification remain manual
follow-up limitations, not claims made by these automated checks.

## Surfaces and hierarchy

- Canvas uses `--bg`; sidebar and table headers use `--bg-subtle`.
- Panels use `--surface`; overlays and notifications use `--surface-raised`.
  Muted cells and separators use `--surface-muted`.
- Panel headers blend the existing subtle/surface tokens. They are quiet anchors
  without a separate palette.
- Dashboard panels share geometry. Health has an accent top rule, Needs Attention
  a warning rule, Suggested Actions an accent-soft header, and Reviews an accent
  heading. Metric cards use a restrained 1px shadow rather than extra height.
- Detail pages retain relationship panels, summary strips and tab order. Deal
  Health, Next Step and Pending Reviews have distinct, compact emphasis.

Page headings are 20px with tight tracking; section headings 12–15px, table/body
copy generally 12px, metadata 10–11px. Numbers use tabular figures. Eyebrows use
restrained uppercase tracking. Hierarchy must not depend on low text opacity.

## Spacing and density

Use a 4px spacing unit, 8–12px internal gaps, 12–16px between related sections,
and existing 12/20px responsive page padding. Preserve fixed virtual dimensions:
Pipeline rows/header 36px, Contacts rows 40px, large Activity/Review feed items
168px. Do not alter their keys, overscan, focus pinning or query behavior.

Panels use 4px radii, controls 2–3px, dialogs 5px. No giant cards, gradients,
glass, decorative charts or illustrations. Keep relationship data in its existing
layout; do not turn every field into a badge.

## Borders and elevation

Use subtle borders for dividers and panel outlines, strong borders for controls
and important boundaries. Warm/dark modes use quieter dividers rather than bright
grids. Avoid shadows on table rows or feeds. Dialogs/notifications retain semantic
elevation. Selected navigation/feed items use an inset rule and tonal fill.

## Shell and records

Keep navigation groups, Favorites and Saved Views distinct. Active navigation uses
weight, an inset accent rule and `aria-current`. Favorites, Saved Views and search
share small 1.5px-stroke SVG icons; adjacent text supplies their accessible names.

Header context, theme, search and shortcut help remain in place. Narrow layouts
use a labeled search magnifier rather than a clipped placeholder. Context can
truncate; theme/search/help remain visible. Theme behavior follows THEMING.md.

## Tables, filters and tabs

Tables retain semantic captions, headers and `aria-sort`. Headers use 11px type,
accent text for sorting and consistent indicator alignment. Hover is subtle;
focus and selection retain accent-soft and visible outlines. Pipeline selection
also has a leading rule. Stage labels use compact neutral boundaries; risk retains
its symbol and text. Fixed row heights and intentional horizontal scrolling remain.

Search/filter controls sit in compact bordered toolbars. Column menus retain
native interaction. Wide tables scroll inside named regions, without expanding
the workspace horizontally. Active tabs use a bottom rule, tonal fill and the
existing `aria-selected` state.

## Reviews and simulated intelligence

The review hierarchy is account/title, deal, source, evidence, diffs, actions.
Evidence has a quiet inset surface and quote boundary; confidence stays explicitly
simulated. Current/proposed labels remain primary. Proposed values use accent-soft,
not red/green meaning. Selected changes have a subtle fill; conflicts have a
warning boundary and captured/current/proposed text with blocked-approval messaging.
Applied, skipped, rejected and edited states stay textual. Actions remain compact;
Undo notifications have an accent rule, with danger treatment for actual errors.

Activity retains two panes, clear type/time hierarchy and compact analysis stages.
Running steps use a tonal fill and marker; waiting/complete/failed labels remain.
Search retains grouping, metadata and keyboard hints, with small entity icons and
type boundaries. Existing listbox/active-descendant behavior is preserved.

## Feedback, motion and accessibility

Loading surfaces share a quiet panel and accent boundary. Error surfaces use
semantic danger treatment and existing Retry actions. Empty/no-result/missing views
retain helpful text and return links. Do not replace them with unlabeled spinners
or illustrations. Labels, live regions and focus restoration remain intact.

Workspace interactions transition only background, border and text colors for
100ms under
`prefers-reduced-motion: no-preference`. No layout or large movement animation.
Forced-colors system outlines remain; selection also retains structural/text cues.
See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for remaining manual testing limitations.

## Theme character

Morning uses warm canvas/dividers and bright reading surfaces. Afternoon is crisp
and neutral. Evening uses dusk layers and warm warning accents. Night uses blue-gray
layers, restrained borders and pale technical accents. Components never branch on
mode; the same treatments consume semantic tokens. Do not mechanically invert colors.

## Visual regression and validation

`tests/e2e/visual.spec.ts` fixes device time, uses fresh native IndexedDB seed and
captures idle states. Morning/Night baselines cover Overview, Pipeline, Account
Detail, Contact Detail, Deal Detail, Reviews, Activity and Search. Responsive
Overview/Pipeline baselines cover 1920, 1280, 768, 390 and 320px. Avoid pixel assertions
for streaming states or random generated records. Existing four-theme axe checks
also cover core routes, editing, conflicts, applied/rejected/undone states and mobile.

Baselines target Chromium on Windows; regenerate deliberately after visual review
on the target rendering platform. Native select popups, real screen readers and
native zoom retain the limitations in ACCESSIBILITY.md.

Premium Workspace UI Polish validation (9 October 2026):

- `npm run typecheck`, `npm run lint`, `npm test` (148 tests),
  `npm run build` and `npm run test:e2e` (43 tests) pass.
- All four modes pass axe scans, including review editing, conflicts, approval,
  rejection, Undo and mobile. Keyboard, reduced-motion and forced-colors checks pass.
- 26 Chromium/Windows screenshot baselines pass comparison: eight surfaces in
  Morning/Night, plus Overview/Pipeline at five viewport widths. Additional
  four-mode core-surface/conflict/mobile captures are browser-run artifacts.
- Responsive inspection corrected crowded tablet header context and wrapped
  currency totals at 320px. Wide tables retain intentional internal scrolling.
- The production stress check uses 500 accounts, 5,000 deals, 10,000 contacts,
  25,000 activities and 1,000 proposals. Initial mounted rows were 26 Pipeline,
  26 Contacts and 9 Activity; bounded review/search DOM checks also pass. These
  are structural observations, not a claim of identical latency on all devices.
- The final build contains 23 JavaScript chunks totaling 1,648,737 raw bytes
  (451,800 bytes summed after individual Node zlib gzip), and 38,738 CSS bytes.
  This is all-route build output, including framework and seed chunks, not one
  page's transfer size. There is no isolated pre-polish timing/bundle baseline;
  do not attribute changes since PERFORMANCE.md solely to this milestone.

No dependencies, models, routes or query logic were added. Virtual dimensions and
fetching behavior remain unchanged. No blocking visual issues were found in the
reviewed captures. Screenshot portability and real assistive-technology testing
remain the limitations described above and in ACCESSIBILITY.md.
