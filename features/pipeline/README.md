# Pipeline

`PipelineWorkspace` consumes repository-backed Query hooks for deals and accounts.
`pipeline-model.ts` joins account names and handles search and presentation.
`pipeline-columns.tsx` defines TanStack Table v8 columns; `PipelineTable` owns
transient search, filters, sorting, visibility, and selection in local state.
No persisted records are copied into Zustand.

All ten business columns are initially visible. Account and Deal stay visible
for context; the others can be hidden and restored. Search covers account, deal,
stage labels, owner ID, risk, and next step even when a column is hidden. Stage
and risk filters use exact matches. Multi-word search matches every term.

Value sorting groups currency codes before comparing numeric amounts, avoiding
an implied exchange-rate comparison. Dates display in UTC. Owner IDs are shown
as demo references because no owner directory or User entity exists.

Selection uses deal IDs and survives sorting/filter changes. Select-all affects
matching rows only; hidden selections are counted and can be cleared explicitly.
No bulk actions are shown before an operation exists.

The table uses semantic HTML, aria-sort, labelled native controls, a mixed-state
selection checkbox, sticky headers, visible focus, and a keyboard-focusable scroll
region. Risk includes a readable label and a distinct symbol as well as color.
The Columns disclosure supports Escape and restores focus to its summary.
The component opts out of React Compiler memoization because TanStack Table v8
exposes mutable instance methods.

Loading, initial storage errors, background refresh errors, empty datasets,
and empty filtered results have distinct states. No Kanban, charts, or pagination are added.

Added dependency: `@tanstack/react-table` v8, the headless table implementation
requested for sorting, filtering, visibility, and selection. Run
`npm run test:pipeline` for table behavior and state-rendering checks.


## Large datasets

Rows are virtualized after TanStack Table filtering and sorting using TanStack
Virtual v3. Each row is exactly 36px high with single-line clipped cell content
and full text available to assistive technology and native title tooltips.
Eight rows are overscanned on each side. The active row is retained if needed
to preserve focus while scrolling; no other offscreen rows remain mounted.
Currency formatters are reused while scrolling.

Native table layout, fixed column widths, and hidden spacer rows keep sticky
headers aligned. `aria-rowcount` and `aria-rowindex` describe the full filtered
result. Arrow Up/Down and Tab/Shift+Tab move between row checkboxes across virtual
boundaries; Home/End and Page Up/Down navigate farther. Space toggles selection.
Native tab entry/exit is preserved at the first and last result. Scroll position
resets when filtering or sorting changes. Filtering scans the full row once,
independently of visible columns. All data stays local and client-side.

In `npm run dev`, use the **Performance dataset** selector to switch between the
saved workspace and 1,000 / 10,000 / 50,000 fictional deals. This is an in-memory
view only: no seed files, IndexedDB records, or Query cache entries are replaced.
Switch back to Saved workspace or reload to restore the normal dataset.
The selector is absent from production builds. Switching datasets resets table
controls and selection deliberately.

The pure developer utility `generateDemoDeals(accounts, count)` lives in
`lib/simulation/generate-demo-deals.ts`. It accepts fictional accounts and creates
deterministic, schema-valid deals linked to those accounts, without reading seed
files or writing storage. It supports up to 100,000 records for custom tests.
