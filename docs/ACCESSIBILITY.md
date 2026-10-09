# DealPatch accessibility

## Scope and principles

Accessibility hardening covers the existing local workspace. No product features,
theme system, remote services or data architecture changes are introduced.
Accessibility is an ongoing engineering requirement, not a conformance claim.

- Preserve native links, buttons, selects, checkboxes, tables and modal dialogs.
- Name controls by purpose and record where relevant. Decorative stars/arrows are
  hidden from assistive technology; favorite buttons expose their pressed state.
- Describe risk, review decisions and diffs in text, independently of color.
- Keep keyboard focus visible and restore it after overlays/editor cancellation.
- Keep asynchronous feedback concise. Live regions supplement visible text.
- Retain virtualization and the deterministic, human-reviewed local workflow.

## Routes and surfaces checked

Automated Chromium checks cover Overview, Pipeline, Accounts, Account Detail,
Contacts, Contact Detail, Deal Detail, Activity and Review Queue. Account detail
Contacts/Opportunities/Activity/Changes and deal detail
Contacts/Reviews/Activity/Changes tabs are scanned as well. Pending and rejected
review states, stale conflicts, rollback errors, proposal validation errors,
command search and shortcut help are scanned in their rendered states.

There is no separate Review History route. History is accessible through Review
Queue's status filter and detail Reviews/Changes tabs. The unused standalone
ReviewHistory component is not claimed as browser-tested.

## Keyboard interaction

| Keys | Action |
| --- | --- |
| Tab / Shift+Tab | Native control/link order, including within Pipeline rows |
| Ctrl+K / Cmd+K | Open workspace search; toggle while search is open |
| Arrow Up / Down | Move through the current table/feed/review/search list |
| J / K | Next/previous item where workspace list shortcuts apply |
| Home / End | First/last item in the focused supported list/table |
| Page Up / Down | Move a viewport in Pipeline |
| Enter | Follow a link, open a highlighted deal/review, or focus activity detail |
| Space | Toggle the focused checkbox |
| A / R | Approve selected eligible review changes / reject remaining changes |
| Escape | Close modal, cancel inline proposal edit, or close a control menu |
| Left / Right | Change account/deal detail tabs |
| ? | Open keyboard shortcut help |

List shortcuts pause in inputs, textareas, selects, textbox/combobox roles and
contenteditable content. Ctrl/Cmd+K deliberately remains a toggle within the
open palette. Dialogs suspend background shortcuts. Shortcut help lets users
disable single-character navigation for speech input/screen-reader character
navigation. Native Tab and arrow controls remain available.

The skip link becomes visible on focus and moves focus into main content.
Client route changes focus main content after overlay cleanup, without forcing
focus on initial load or repeatedly moving it as data arrives. Next.js provides
route announcements and route metadata. Record detail titles are generic page
titles; the loaded record name is in the H1.

Native modal dialogs make the background inert, receive focus, contain Tab
navigation and support Escape. Closing restores the opener or a meaningful
fallback. Proposal editors are inline forms, not additional modal dialogs.
Validation marks the editor invalid, associates error text and returns focus
to the field. Cancel/Escape returns to Edit. Saved-view validation also focuses
its name input. Notifications do not focus themselves on arrival; explicit
Undo/Dismiss actions move focus only when their action control disappears.

## Review and asynchronous semantics

Diff groups identify the field and target; current/proposed values have visible
labels. Captured values remain available in conflicts. Edited, applied, skipped,
rejected and stale states use text. A persistent polite status region announces
new stale conflicts and says approval is blocked. Existing error alerts explain
rollback and failed Undo without claiming a write succeeded.

Analysis announces start, completion and cancellation, rather than every
intermediate event. Stage states remain visible as Waiting/Running/Complete/Failed.
Analysis failure, proposal send confirmation, review decisions and Undo use
status/alert regions. The search combobox uses activedescendant for selected
options; its result-count region no longer repeats the selected option label.
Actual speech timing and verbosity still require screen-reader validation.

## Issues found and changes made

- Pipeline intercepted Tab between row checkboxes, skipping row links. Native
  Tab order is restored; arrows/Home/End/Page keys still navigate virtual rows.
- Favorite controls lacked record context. Detail and expanded favorite controls
  now name the account, contact or deal and keep aria-pressed.
- Activity waiting labels and Overview stage numbers had 2.62:1 contrast in the
  baseline axe report. Their text is darker. Selected search metadata had 4.31:1
  contrast; it now uses darker text too. No axe rules were disabled.
- Participant links within Account/Contact/Deal activity text lacked a persistent
  non-color distinction. Underlines now identify these links without hover.
- Stale conflict feedback lacked a dedicated live announcement. A concise
  account/proposal-card status now reports the conflict.
- Added reduced-motion overrides and system-color focus/selection outlines for
  forced-colors mode. No animation is needed to understand workflow state.
- Added meaningful route focus and saved-view invalid-submission focus handling.

## Automated testing

Development-only `@axe-core/playwright` 4.13.0 (and its axe-core dependency) runs
locally against the production application. This package was chosen because
contrast/ARIA/landmark auditing is not practical to reproduce as handwritten
assertions. It does not enter the production client bundle or require credentials.
See the [upstream project](https://github.com/dequelabs/axe-core-npm).

```sh
npm install
npx playwright install chromium
npm run build
npm run test:a11y
```

The suite uses the real IndexedDB initializer with fresh contexts/reset fixtures.
It runs all default axe rules (including applicable contrast/best-practice rules)
without exclusions, attaches full reports including incomplete/manual checks,
and separately checks duplicate IDs and visible tabbable content under aria-hidden.
Do not interpret no violations as complete WCAG coverage.

Keyboard tests cover modal containment/restoration, palette arrows/Enter/Escape,
both shortcut modifiers, editor validation/cancel, sorting aria-sort, native
Pipeline Tab/Space/Enter, columns, relationship tables and contextual favorites,
saved-view dialogs, shortcut suppression, Activity selection/analysis/send,
review diff semantics, conflict/rollback, approval/Undo announcements and history.
Two additional Node tests cover diff conflict semantics and favorite names/state.
The original review golden-path/rollback/unsafe-Undo tests and performance stress
checks remain part of the full browser suite.

Responsive tests use 390 × 844, 768 × 844 and 720 × 500 CSS-pixel viewports. The
last reproduces the reflow area of 1440 × 1000 at 200% browser zoom; it is not a
native browser UI zoom test. Tests check main horizontal overflow, dialog search
and Close visibility, and keyboard access to offscreen mobile analysis/approval
controls. A separate root-font-size 200% test checks enlarged rem-based content
and the review dialog; fixed pixel metadata is not enlarged by this emulation.
Root CSS zoom was discarded because it does not reproduce native viewport-unit
or breakpoint behavior. Reduced-motion and forced-colors are browser-emulated.

## Manual observations and limitations

An interactive browser walkthrough used an isolated production preview at port
3110, separate from both the development workspace and automated fixture origin.
Observed sidebar navigation, Pipeline J/Space/Tab/Enter, deal detail navigation,
review field checkbox selection, partial approval, Undo and grouped command search.
Visible focus was inspected on the Pipeline deal link and command search input.
The browser accessibility tree exposed field names, current/proposed labels,
contextual stars and review outcomes. Mobile/large-text screenshots were also
visually inspected. These observations are not a real screen-reader pass.

**NVDA/JAWS/VoiceOver testing was not completed.** Native Windows app control was
not available in this session, and browser accessibility-tree inspection cannot
substitute for listening to a real screen reader. Native browser zoom shortcuts
did not change the in-app preview viewport; actual 200% browser zoom and OS high
contrast still require a manual browser/assistive-technology pass. Automated
keyboard coverage is broader than the interactive walkthrough; not every shell
or form path was repeated manually.

## Virtualization tradeoffs and remaining work

Pipeline always virtualizes; Contacts, Activity and Reviews virtualize large
lists. Native table headers/captions/aria-sort are retained, with total/index
metadata on virtualized tables; virtual feeds expose set size/position. Focused
or selected destinations are pinned to avoid unmounting focused rows. Arrow,
Home/End and Pipeline page keys can reach rows outside the mounted window.

Screen-reader browse mode, Find in page, sequential Tab at a rendered-window
boundary and browser accessibility-tree table navigation cannot expose every
unmounted record. Use list navigation/search/filtering to reach those records.
Fixed-height large-list previews truncate long content; detail surfaces expose
full text. Extreme text-only enlargement with stress datasets and real screen
readers needs further validation. Virtualization is intentionally preserved.

Future work is validation with NVDA/Firefox, JAWS/Chromium and VoiceOver/Safari;
native 200%/400% zoom and text-only zoom; OS forced-colors themes; focus-indicator
contrast and touch-target review; and listening to async announcements under
slow/error conditions. Axe incomplete results must be reviewed with those tools.
No WCAG AA certification or exhaustive contrast guarantee is claimed.

Dependency installation also reported five high-severity npm audit findings in
the existing ESLint/Next lint chain (`braces` → `micromatch` → `fast-glob` → Next
ESLint). They do not originate in axe. npm proposes a major downgrade of
eslint-config-next; it was not applied during accessibility work.

## Final validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 137 tests passed.
- `npm run build`: passed.
- `npm run test:e2e`: 34 Chromium tests passed, including the validated review
  workflow, performance checks and accessibility cases.
- `npm run test:a11y`: 22 Chromium tests passed independently. Axe scans reported
  zero violations with no rule exclusions; incomplete checks remain subject to
  manual review. This is not a screen-reader or WCAG conformance certification.

## Files in this milestone

- `app/globals.css`: reduced motion and forced-colors focus/selection rules.
- `components/layout/workspace-keyboard.tsx`: focus after client route changes.
- `features/pipeline/pipeline-table.tsx`: native Tab order and caption guidance.
- `features/contacts/contacts-table.tsx`: virtualization caption guidance.
- `features/favorites/favorite-button.tsx`, `features/favorites/favorites-section.tsx`,
  `features/accounts/account-detail-workspace.tsx`,
  `features/contacts/contact-detail-workspace.tsx`, `features/deals/deal-header.tsx`:
  record-specific star names.
- `features/accounts/account-detail-sections.tsx`, `features/deals/deal-sections.tsx`:
  persistent link underlines.
- `features/overview/dashboard-summary.tsx`, `features/activity/agent-panel.tsx`,
  `features/search/command-palette.tsx`: measured contrast fixes and concise
  analysis/search announcements.
- `features/reviews/review-card.tsx`, `features/reviews/review-change.tsx`:
  conflict announcements and named diff groups.
- `features/saved-views/saved-view-dialog.tsx`: invalid-submission focus.
- `tests/accessibility.test.ts`, `tests/e2e/accessibility.spec.ts`: new checks.
- `tests/deals.test.ts`, `tests/favorites.test.ts`: contextual-label expectations.
- `tests/e2e/performance.spec.ts`: simulation-start assertion follows the new
  concise status message; stress checks and thresholds remain unchanged.
- `package.json`, `package-lock.json`: dev-only axe integration and test:a11y script.
- `.gitignore`: keep this accessibility document trackable alongside PERFORMANCE.md.
