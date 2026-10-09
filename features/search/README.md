# Local workspace search

The header and Ctrl/Cmd+K open the same native modal dialog. Ctrl/Cmd+K toggles it
even while its search input is focused; ordinary inputs elsewhere retain their
shortcuts. IME composition and held toggle/open keys do not trigger actions.
Escape closes, background shortcuts pause, and the captured opener receives focus
on close. Standard Tab remains contained by the shared dialog.

The input is a labelled combobox with aria-activedescendant pointing to the selected
listbox option. Arrow keys move within the flattened grouped results; Enter opens
the selected result. Selection scrolls into view. Pointer selection uses the same
navigation callback. Groups announce their type and shown/total counts. Loading,
empty/no-match and recoverable incomplete-results error states are explicit.

The feature mounts its query observers only while open. Accounts, contacts, deals
and activities reuse existing list hooks/caches. A validated getAll proposal read
and shared proposals.list query include pending and reviewed history. Existing
review invalidation covers the whole proposals prefix. No JSON reads or Dexie
imports exist in presentation components.

The in-memory index rebuilds when cached record arrays change. It normalizes case
and Unicode compatibility, then requires every whitespace-separated term to be a
substring of relevant text. No fuzzy search, remote service or new dependency.
Groups stay Accounts, Contacts, Deals, Reviews, Activities. At most six matches per
group render, with total counts and a hint to narrow the query. Empty search shows
the first six stored records in each group; these are not labelled as recent.

Indexed fields:
- Accounts: name, industry, region.
- Contacts: first/last name, role, email, account name.
- Deals: title, account, machine/display stage, next step.
- Reviews: account, related deal, machine/display field names, evidence text.
- Activities: title, summary, account, related deal.

Account/deal joins verify account IDs, with missing relationships handled explicitly.
All labels are escaped React text; destinations encode opaque IDs.

Navigation:
- Account/contact: existing detail routes.
- Deal: /deals/id opens the dedicated Deal Detail workspace.
- Review: /reviews?proposal=id focuses/highlights a pending card. Reviewed proposals
  show their status with an account-history link; deleted IDs show a missing state.
- Activity: /activity?activity=id selects/focuses the source without starting analysis.
  Deleted IDs show a missing-target message.

Three small route pages read async searchParams and pass optional targets. Query
navigation keys reset only those workspaces; data remains in the shared query cache.
These routes render dynamically to read URL context. IndexedDB stays browser-only.

Created:
- features/search/search-index.ts
- features/search/use-search-data.ts
- features/search/command-palette.tsx
- features/search/README.md
- features/reviews/use-proposals.ts
- tests/search.test.ts

Modified:
- components/layout/workspace-keyboard.tsx
- lib/repositories/proposals.ts
- lib/query/keys.ts
- app/pipeline/page.tsx
- app/reviews/page.tsx
- app/activity/page.tsx
- features/pipeline/pipeline-workspace.tsx
- features/pipeline/pipeline-table.tsx
- features/reviews/review-workspace.tsx
- features/activity/activity-workspace.tsx

Accounts, Contacts, Overview, domain models and database schema are unchanged.

