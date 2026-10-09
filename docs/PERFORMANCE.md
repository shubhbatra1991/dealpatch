# DealPatch performance hardening

Validated on 9 October 2026. No new product features, backend, network search,
runtime test switches, or dependencies were introduced.

## Reproduce

```sh
npm install
npx playwright install chromium
npm run build
npm run test:performance
```

`npm run test:e2e` includes the performance regression case and the 11 validated
Review Queue browser tests. The performance case uses a fresh Chromium context
and real native IndexedDB on the isolated production server at localhost:3100.
It clears all stores and imports the generated, schema-validated fixture in one
transaction. Closing the test context discards it. It never touches the normal
development origin or replaces `data/seed/*.json`.

`lib/simulation/generate-stress-workspace.ts` accepts validated fictional seed
templates and optional counts. Default sizes are:

| Entity | Count |
| --- | ---: |
| Accounts | 500 |
| Deals | 5,000 |
| Contacts | 10,000 |
| Activities | 25,000 |
| Pending proposals | 1,000 |

IDs, dates, names, participants, proposal snapshots and evidence are deterministic.
All relationships and domain schemas are checked in the unit suite. The generator
is not imported by production routes; no generated JSON fixture is shipped.

## Measurement method and limitations

The isolated before/after runs used a production Next.js 16.3.8 build, Chromium
156 (Playwright 1.64.0), Windows, Node 24.19.0 and an Intel i5-10300H 2.50 GHz CPU.
Viewport: 1440×1000. No CPU or network throttling; no React development mode.

The performance test measures Node `performance.now()` around each Playwright
action, its readiness assertion where specified, and two animation frames.
These numbers include browser automation, hydration, repository reads, layout
and assertion overhead. They are single observations, not p95s, Core Web Vitals,
pure render durations, or universal performance guarantees. Initial render means
full route navigation to data-ready UI, excluding fixture generation/import.

Chrome DevTools Protocol `Performance.getMetrics` records heap, DOM node count,
script, layout and style durations. Durations are cumulative within the current
document, not per-component timings. A browser PerformanceObserver records tasks
of at least 50 ms. A test-only React DevTools commit hook observes rendered fibers;
production component names are mostly minified. The named ActivityFeedRow memo
boundary can be identified. No CI assertion depends on private React internals.
This is diagnostic sampling, not a React Profiler flamegraph or allocation trace.

Raw JSON is attached to the Playwright report as `production-performance` and
written to each performance test's output directory. Baseline captures during
this task are under `node_modules/.cache/performance-baseline-complete`; the
isolated optimized capture is under `node_modules/.cache/performance-after`.
Generated reports/traces are ignored. Concurrent full-suite timings are higher;
the comparison below uses one-worker isolated observations.

## Findings and changes

| Observation | Before | After |
| --- | ---: | ---: |
| Contacts data-ready UI | 12,225 ms | 738 ms |
| Mounted contact rows | 10,000 | 25 data rows + 2 spacers |
| Contacts search | 1,904 ms | 130 ms |
| Activity data-ready UI | 8,186 ms | 654 ms |
| Mounted activity entries | 25,000 | 9 |
| Activity selection | 6,866 ms | 135 ms |
| Activity type filtering | 2,431 ms | 104 ms |
| Review Queue data-ready UI | 2,107 ms | 411 ms |
| Review navigation | 315 ms | 53 ms |
| Review approval/badge observation | 508 ms | 225 ms |

Contacts initially created 230,675 elements and Activity 225,715. Optimized
initial captures had 1,275 and 796 respectively. Contacts previously scanned all
25,000 activities for each of 10,000 contacts. A one-pass participant/date and
proposal index now resolves those relationships while preserving account scoping
and counting multi-field contact proposals once. Standalone Node measurements
using the same fixture changed contact projection from 3,862 to 30 ms and seed
relationship validation from 2,727 to 163 ms. These are also single local samples.

Large Contacts, Activity and Review lists now use the existing TanStack Virtual
dependency above 200 matches. Normal demo lists retain their full semantic
rendering. Contacts use 40 px rows; activity/review previews use 168 px rows with
truncated preview text and complete detail panes. Stable entity IDs supply keys.
Overscan is eight table rows or four feed items. A selected/focused destination
is pinned during navigation so Home/End and arrow navigation can mount it before
focus moves. Tables expose total row counts/indices; feeds expose positions and
set sizes. Virtual previews intentionally trade complete offscreen DOM content
for bounded rendering; full source/diff text remains in the detail surface.

Activity rows have a measured memo boundary and stable selection callback. The
optimized selection sample observed two row renders rather than rendering the
whole feed. Analysis events do not change feed row props. Switching activity
still cancels analysis; the stress test checks reset to Waiting with no send.

Review reads batch referenced accounts/deals/contacts/activities instead of
issuing individual per-proposal target lookups. They retain schema validation,
missing-target visibility and account checks. Transactions and live approval
stale checks are unchanged. Approval/Undo cache patches preserve unaffected
record references. Refetches target proposal lists, the relevant account's
proposal/audit history, and only modified entity types. Editing/rejecting a
suggestion does not refetch CRM entity lists. An active-query regression test
verifies unrelated entity and account query functions are not called again.

The singular notification now reads "1 change"; plural notifications and
remaining-change messages use the appropriate forms.

## Other surfaces inspected

- **Pipeline:** existing virtualization already mounted 27 rows at 5,000 deals.
  Stable IDs, focused-row pinning, headers and filters were retained. Isolated
  optimized observations: initial 406 ms, End navigation 160 ms, sorting 261 ms,
  risk filter 143 ms, search 107 ms, columns 243 ms and row selection 105 ms.
  The regression case also checks stage filtering, selection and row limits after
  scrolling. No extra memoization or server pagination was introduced.
- **Contacts:** search, status/account/region filters, sorting and End navigation
  are tested against the complete dataset. Options are derived once per data
  snapshot rather than recomputed on every focus/filter render.
- **Global Search:** the existing normalized, precomputed index contains 41,500
  records and caps results at six per group. Optimized isolated observations:
  open 260 ms, input-to-visible observation 101 ms, keyboard movement 109 ms.
  Grouping and partial/case-insensitive matching are regression-tested. No fuzzy
  library, remote index, worker or duplicate persistent index was justified.
- **Overview:** initial observation 525 ms; its existing memoized aggregate and
  bounded summary lists were retained. No repeated per-contact work was found.
- **Accounts:** initial observation 877 ms at 500 accounts, around 10,171 elements.
  The existing relationship projection is memoized. No virtualization was added
  at this size; account DOM growth remains a future constraint.
- **Deal Detail:** initial observation 1,044 ms. Existing account-scoped projection
  and small related lists were retained; no blanket useMemo/useCallback changes.

## Long tasks, layout and memory

The optimized initial document samples still had a 126 ms Pipeline task, 197 ms
Contacts task, 59 ms Activity task and 123 ms Accounts task. The Review Queue,
Overview and Deal Detail initial samples had no observed tasks >=50 ms.
These observations do not prove absence of later long tasks.

Contacts initial cumulative layout/style time was 9.1/7.2 ms; Activity 6.5/6.9 ms;
Review Queue 2.7/3.9 ms. Stable virtual row sizes avoid measuring thousands of
DOM rows on scroll. A sample of a viewport is not a smoothness/FPS guarantee.

The optimized sampled heap grew during navigation (about 272 MiB before forced
GC), compared with about 1,117 MiB at the end of the baseline route sequence.
After explicit CDP garbage collection, optimized heap samples were 23.7 MiB and
10.9 MiB after another full-navigation cycle. No monotonic retained growth was
observed in those two samples. This is not a long-session leak proof: full document
navigations discard query clients and differ from extended SPA navigation. Query
data and session Undo receipts remain in memory; large numbers of approvals in
one session warrant a separate long-duration allocation study.

## Production bundle review

Used the bundled Next.js analyzer, without installing another package:

```sh
npx next experimental-analyze --output
npm ls react react-dom @tanstack/react-query @tanstack/react-table @tanstack/react-virtual dexie zod
```

Analyzer output lives in `.next/diagnostics/analyze`. All emitted `.js` files under
`.next/static/chunks` totaled 1,642,770 raw bytes and 450,162 bytes when each file
was compressed with Node `zlib.gzipSync`. This includes every route, deferred seed
chunks, framework code and legacy polyfills; it is **not** one page's download.
The test additionally records actual per-document JavaScript resource sizes.

Largest analyzed client contributions included React DOM (~200.7 KB), legacy
polyfills (~112.6 KB), Dexie (~95.5 KB), normal activity seed JSON (~58.9 KB), and
Zod's compile module (~55.7 KB). Dexie and runtime schemas are required for the
local persistence/security boundary. No necessary package was removed. The seed
remains dynamically imported only for empty-store initialization/reset. React,
React DOM and the requested runtime libraries resolve to single package versions.
No stress generator, Playwright, fake-indexeddb or E2E modules appear in the
analyzed client graph. No unexpected chart, fuzzy-search or AI package exists.

## Regression checks and remaining limits

Four new unit cases cover generator determinism/validation/relationships,
large search/filter correctness, contact aggregation boundaries, and targeted
query invalidation. The large-dataset Playwright case checks bounded mounted
rows, keyboard destinations, filters/sorting/search, columns, row/change
selection, simulation start/cancellation, grouping and approval badge updates.
There are no latency thresholds or exact-millisecond CI expectations.

The dataset is synthetic, regular and short-text oriented. Real distributions,
very long source text, lower-powered/mobile devices, browser storage quotas,
Firefox/WebKit and long sessions remain unmeasured. IndexedDB reads and TanStack
row models still load/process complete collections; virtualization bounds DOM,
not total data memory. Main-thread index/filter/schema work can still produce
long tasks. Account lists, native account filter options and Undo history can
grow. Global search rebuilds its in-memory index when source snapshots change
or the palette remounts. No cross-tab live synchronization is added.

A real server-backed architecture would introduce indexed server queries,
cursor pagination/windowed fetching, server-side search/aggregates, scoped cache
invalidation and concurrency/version checks enforced by the server. Workers or
incremental local indexes should be considered only after further measurement.
Those changes are deliberately outside this milestone.

Final checks: typecheck, lint, 135 unit tests, production build and 12 Chromium
Playwright tests (the original 11 review flows plus the stress case).
