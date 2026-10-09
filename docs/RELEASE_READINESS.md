# Open-source release readiness

Validated 9 October 2026 on Windows, Node.js 24.19.0 / npm 11.6.2.
This report covers the local release candidate, not a published release.

## Release gate

The local candidate passes the functional release gate. No functional blocker was
found in the tested scope. The development-only advisory below is accepted.
Public release is still blocked on reviewing/committing/pushing the intended
candidate files, including six currently missing public docs. No deployment,
upload, remote commit or case study was performed.

| Check | Result |
| --- | --- |
| Fresh clone + `npm install` | Passed; 374 packages installed |
| `npm run dev` | Passed: fresh Chromium storage, landing/themes/seeding/analysis/reviews |
| `npm ci` | Passed: 374 packages installed from unchanged lockfile |
| `npm run typecheck` | Passed, including automatic Next route type generation |
| `npm run lint` | Passed, zero warnings/errors |
| `npm test` | 149 passed, zero failed/skipped |
| `npm run build` | Passed: optimized production App Router build |
| `npm start` | Passed: production server exercised by all 62 browser tests |
| `npm run test:e2e` | 62 passed: 54 Chromium, 4 Firefox, 4 WebKit; zero retries/skips |
| Accessibility suite | Passed: 22 workspace cases plus landing/theme/overlay axe scans; zero reported violations |
| Stress/performance regression | Passed with 500 / 5,000 / 10,000 / 25,000 / 1,000 records |
| Visual regression | Passed: all 34 existing baselines, without regeneration |
| Cross-browser release smoke | Passed: 12/12 cases across Chromium, Firefox and WebKit |
| `npm audit` | Exit 1: five high development dependency findings, one advisory |
| `npm audit --omit=dev` | Exit 0: zero vulnerabilities |
| `npm run check:repository` | Passed: 272 candidate files |
| `git diff --check` | Passed |

## Clean-install method and findings

An isolated Git snapshot was created from the current tracked and unignored
candidate files, including pre-existing uncommitted landing/route changes.
Generated files, dependencies, environment files and browser data were excluded.
That snapshot was cloned into a new temporary directory outside this repository,
then installed without copying dependencies or build caches. Port 3101 was used
for the development smoke to keep it separate from an existing workspace.
Production browser tests use `npm start -- --port 3100` via Playwright's webServer.
A normalized source comparison verified all 201 non-documentation candidate files
match the standalone clone; only documentation was subsequently finalized.
No application environment variables, API keys, authentication or service setup
were provided. Package and browser installation require normal registry/download
access; application workflows use local data afterward.

The first validation copy was nested under ignored `node_modules/.cache`. This
caused a Next.js parent-lockfile warning, altered React lint diagnostics and
prevented TypeScript from emitting imported seed JSON in the test output. That
location is unsuitable for proving a normal clone; it was replaced by the
standalone temporary clone. These environment-only results are not release gates.

A `pretypecheck` hook now runs `next typegen`: ignored Next route/environment types
are generated on a clone before `tsc --noEmit`, without relying on a prior dev or
production build. Strict compiler settings remain unchanged.

**Publication prerequisite:** the main working tree still contains this task and
prior milestone changes. Its Git history was not committed or pushed by this
task. The fresh clone above proves the candidate snapshot, not that today's
public remote default branch contains it. Commit/review/push the intended files
and rerun from that public revision before claiming a published release is ready.
Unauthenticated HEAD checks confirm the current public branch returns 404 for
PRD, ARCHITECTURE, DATA_MODEL, ENGINEERING_RULES, ROADMAP and DECISIONS under
`docs/`; these existing files were locally ignored. DESIGN_SYSTEM, PERFORMANCE,
ACCESSIBILITY and THEMING return 200. The ignore fix makes all ten documents
available in the candidate clone, but publishing them is still required.

## Browser and workflow coverage

Playwright 1.64.0 engines: Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2.
Each release case starts with a new browser context and real native IndexedDB.
No application persistence layer is mocked.

Four release cases run in each engine:

1. Landing with empty storage and Automatic theme; workspace entry and seeding;
   Pipeline search; persisted favorite and saved view; global search; Activity
   simulation; sending a proposal; approval, pending badge, Deal Detail/audit and
   reload persistence. The normal production flow captures console warnings and
   errors, page errors, failed requests/responses and off-origin requests.
2. Actual `resetWorkspace()` after edits, approval/audit, a generated proposal,
   favorites and a saved view. Assert all eight store counts, restored deal values,
   usability and persistence after reload.
3. Malformed persisted deal, missing account relationship, and invalid account,
   contact and deal IDs show explicit errors/fallbacks/not-found states.
4. Unavailable IndexedDB shows a visible initialization error with Retry.

Existing Chromium suites retain review golden path, partial approval, edit/reject,
conflict and rollback messaging, unsafe Undo protection, keyboard/focus behavior,
themes, accessibility, visual comparisons and the large-dataset structural check.
Test synchronization waits for persisted mutations and route completion before
reload; selectors scope errors and search options to their accessible containers.
An initial complete run passed 61/62 checks: Firefox completed the workflow but
reported a script-load warning during rapid forced full-page navigation. The
release workflow now uses the product's Accounts/Pipeline links, preserving normal
client navigation; three repeated Firefox checks passed with strict console
assertions unchanged. Normal navigation-aborted requests are recorded separately
from unexpected network failures in test attachments. No console warning is
suppressed. Final full-suite results supersede that diagnostic run.

Only expected localhost framework/application requests occurred in successful
normal production workflows. GitHub source/documentation/security/license links
are intentional external navigation; fictional company websites use `.example`.
No external AI, telemetry, fonts, database or search endpoint is required.

## Local persistence and error resilience

Normal seed: 30 accounts, 80 contacts, 60 deals, 150 activities, 15 proposals;
zero audit events, favorites and saved views. First workspace entry validates and
seeds an entirely empty database. Landing alone creates no database. Reload keeps
CRM edits, proposal state, audit history, favorites, views and the chosen theme.

`resetWorkspace()` is an existing developer function, not a new product control.
It validates the seed and atomically clears all eight stores, restores the five
business seed collections, and removes generated proposals, local edits, audit
history, favorites and saved views. Theme localStorage is unaffected. Reload
refreshes Query caches. Reset is destructive by explicit intent; normal review
and Undo keep audit events append-only. See [database usage](../lib/db/README.md).
The reset browser fixture bundles this actual function into an ignored cache and
serves it only through Playwright interception; no debug endpoint ships.

Release inspection found account/deal/activity/basic-proposal repository reads
trusted persisted objects without runtime validation. These reads now parse the
existing domain schemas, so malformed records reach the existing error UI rather
than poisoning cached domain values. One unit regression covers all four read
boundaries and verifies rejection does not rewrite storage. No domain, schema,
migration or normal UI behavior changed. Missing relationships remain visible;
partial storage is preserved, not automatically repaired. Existing atomic review
and failed-reset tests verify rollback; stale and Undo conflicts never overwrite a
newer persisted value.

## Dependency review

All declared dependencies are used and correctly categorized. None were added,
removed or force-upgraded; the lockfile is unchanged. No overlapping router,
state, search, charting or AI SDK was found.

| Package | Category and immediate use |
| --- | --- |
| `next` | Runtime: App Router, rendering, navigation and local web server |
| `react` | Runtime: component/hook implementation |
| `react-dom` | Runtime: rendering and focused virtual-row updates |
| `@tanstack/react-query` | Runtime: repository data caches and mutations |
| `@tanstack/react-table` | Runtime: dense table models, sorting and filters |
| `@tanstack/react-virtual` | Runtime: bounded mounted rows/feed items |
| `dexie` | Runtime: IndexedDB schema, indexes and atomic transactions |
| `zod` | Runtime: seed, persisted-record and mutation validation |
| `@playwright/test` | Development: real-browser workflow and visual testing |
| `@axe-core/playwright` | Development: browser accessibility checks |
| `fake-indexeddb` | Development: isolated persistence/transaction unit tests |
| `typescript` | Development: strict checking, Node tests and reset-test loader |
| `@types/node` | Development: Node script/test declarations |
| `@types/react` | Development: React declarations |
| `@types/react-dom` | Development: DOM-renderer declarations |
| `eslint` | Development: lint runner |
| `eslint-config-next` | Development: matching Next/TypeScript/React lint rules |
| `tailwindcss` | Development: generated application styles |
| `@tailwindcss/postcss` | Development: Tailwind build integration |

Production audit reports **zero vulnerabilities** at validation time. Full audit
reports five high findings through `eslint-config-next` → `@next/eslint-plugin-next`
→ `fast-glob` → `micromatch` → `braces`. They trace to
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack
exhaustion from deeply nested brace patterns; no patched version is listed.
The offered fix downgrades the Next ESLint config to 14.2.35, incompatible with
this Next 16 project. This development-only risk is accepted for trusted repository
patterns; do not lint untrusted pattern input. Recheck the advisory before release
and update the compatible toolchain when a fix exists. `npm audit fix --force`
was not run. An audit is a point-in-time advisory check, not proof of security.

## Repository and documentation hygiene

- Removed the blanket docs ignore and AGENTS ignore so required source-of-truth
  documents ship with clones. Added editor, log, temporary and database ignores.
- Generated Next output, dependency directories, coverage, Playwright reports,
  failure artifacts, environment files and TypeScript build cache stay ignored.
  No matching generated artifact is tracked. Intentional visual baselines remain.
- `check:repository` checks tracked plus unignored candidate files, required docs,
  relative Markdown file/image targets, generated artifacts, credential signatures
  and personal filesystem paths in Markdown. All required documentation exists.
- Additional text searches reviewed credential assignments/private URL patterns;
  a high-signal credential scan covered all nine reachable main-repository commits
  with zero matching files. No credentials or private machine paths were found in
  the candidate documentation. Signature scans do not prove absence of every
  possible secret. Unauthenticated HEAD requests to source, README, SECURITY and LICENSE return
  HTTP 200. This does not certify their remote contents match the candidate.
  Anchor validity is not automated.
- README now includes clone/install/dev steps, tested runtime, local-first and
  educational scope, fictional data, simulated intelligence, product routes,
  four current fictional screenshots and concise contribution/security/doc links.
- Added CONTRIBUTING, public disclosure policy and a concise documentation index;
  repaired the security principles document's unclosed code fence. Public security
  navigation now opens the disclosure policy. MIT LICENSE remains unchanged and
  correctly linked; copyright is 2026 Saurabh Batra.
- Documentation screenshots were visually inspected: no browser chrome, private
  paths or real customer information. Three reuse current validated workspace
  baselines; landing is captured from the current production page.

## Accessibility, performance and limits

Final suite counts are recorded in the release gate above. Axe and visual checks
remain Chromium on Windows, across four themes, desktop/mobile and key overlays.
Native screen readers, real browser zoom, macOS/iOS Safari and other operating
systems are not certified by this validation. WebKit here is a Playwright engine
smoke target, not a complete Safari certification.

Performance regression uses deterministic 500 accounts, 5,000 deals, 10,000
contacts, 25,000 activities and 1,000 proposals with real IndexedDB. It checks
bounded virtualized DOM, search/filter/sort, selection, keyboard destinations,
analysis and review cache behavior; no brittle millisecond budget is introduced.
[Measured profiling and bundle observations](PERFORMANCE.md) remain applicable as
historical measurements; this release does not invent new benchmark numbers.
Validation at repository read boundaries adds linear schema work, while collection
reads and local indexes still consume memory proportional to dataset size.

Non-blocking test-tooling limitation: the reset fixture uses Next's bundled webpack
through an internal package path, avoiding another dependency; review it when
upgrading Next.

Non-blocking limitations: browser storage is user-editable, may be unavailable or
quota-limited, and can be cleared/evicted. It is not encrypted storage, tamper-proof
history or a backup. No cross-tab live synchronization or remote durability exists.
Undo receipts are session-scoped and do not survive reload. Screenshot baselines
are platform-specific. Strict CSP and deployment HSTS remain deferred until a
runtime-aware HTTPS deployment design is requested. See [security](../SECURITY.md)
and [accessibility](ACCESSIBILITY.md).

## GitHub metadata recommendations

Description: **Open-source, local-first sales workspace demonstrating human-reviewed
CRM automation with fictional data.**

Topics: `nextjs`, `react`, `typescript`, `crm`, `frontend`, `indexeddb`,
`tanstack-query`, `accessibility`, `open-source`, `ai-ui`.
The UI and README explicitly identify deterministic simulation; these suggestions
make no claim of a real AI provider. No repository settings were changed.

## Files in this milestone

- `.gitignore`, `package.json`, `playwright.config.ts`.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/Readme.md`,
  `docs/SECURITY.md`, `docs/ROADMAP.md`, `docs/RELEASE_READINESS.md` and four
  `docs/images/*.png` documentation images.
- `lib/project.ts`, `lib/db/README.md` and repository read validation in
  `lib/repositories/{accounts,deals,activities,proposals}.ts`.
- `scripts/check-repository.mjs`, `scripts/build-browser-test.cjs`,
  `scripts/typescript-test-loader.cjs` (CommonJS imports are explicitly scoped to
  test tooling for ESLint), `tests/repositories.test.ts`, `tests/e2e/release.spec.ts`
  and `tests/e2e/README.md`.
- Previously ignored existing AGENTS, PRD, ARCHITECTURE, DATA_MODEL, ENGINEERING_RULES
  and DECISIONS documents are now eligible for version control. Other working-tree
  landing/route-migration changes predate this milestone and were preserved.
