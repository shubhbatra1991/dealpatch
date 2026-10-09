# Accounts

`/accounts` uses the existing account, deal, activity and pending-proposal query
caches. Search matches all terms across name, status, industry, region and owner;
status and region filters are exact and compose with search and sorting. Missing
regions have a separate filter. Pipeline totals exclude both terminal stages and
remain grouped by currency; sorting compares currency groups, then amounts.

Account names are native links, including modified clicks. Pointer clicks on the
rest of a row open the same route. Tab, J/K, up/down and Home/End navigate links;
Enter opens details. Workspace shortcuts already pause while typing. The table
uses a bounded scroll area with sticky headers and horizontal overflow.

`/accounts/[accountId]` reuses accounts/deals/activities and adds account-scoped
contact, complete proposal-history and audit reads. All displayed relationships are
filtered by accountId. The five tabs use roving focus and arrow/Home/End controls.
An unknown account is handled client-side because its existence is browser-local.

Open-deal risks include medium/high risk, overdue UTC close dates, missing next
steps, and at least 14 days without recorded deal activity (or none recorded).
Activity summaries use the latest stored activity or deal lastActivityAt. Key
contacts are the first four active contacts alphabetically, not inferred owners.

Changes separates pending proposals from reviewed proposals and shows live current
values, original generation snapshots, suggestions, evidence and stale warnings.
Generation time is not a review timestamp. Account-related audit events show actual
action times and previous/next snapshots. Database v2 preserves v1 records and adds
an initially empty audit store: earlier actions are never reconstructed.

Review approval/undo appends one event per field; edits/rejections append a proposal
state event. Suggested-field edits are labelled as such, not CRM writes. Audit and
review changes commit in one transaction; failure rolls back both. The audit
repository exposes reads only. Explicit developer demo-reset clears history along
with the rest of the demo workspace. Audit data is browser-local, not tamper-proof.

Activity resolves related deals and participant contacts within this account, with
explicit missing references. Opportunities include probability and a keyboard
accessible preview using the shared dialog; no deal-detail route is invented.
Contact links use the existing Contacts page. Native links preserve browser history.

Review writes invalidate contact, proposal-history and audit queries as well as
existing shared caches, so related edits/approvals/undo are read after persistence.
Website links validate HTTP(S) at rendering time, even for browser-edited storage.

No dependency, seed, domain-model, Overview, sidebar or global-search changes.
`tests/accounts.test.ts` covers joins, table filters/sorting, currencies, SSR
states, safe rendering, query delegation/invalidation and persisted scoped reads.

`tests/account-detail.test.ts` additionally covers v1 migration, audit append/undo,
transaction rollback on audit failure, current-value diffs and related activity.

## Account Detail completion files

Created: lib/repositories/audit.ts, tests/account-detail.test.ts.

Modified: features/accounts/account-detail-sections.tsx,
features/accounts/account-detail-workspace.tsx, features/accounts/accounts-model.ts,
features/accounts/use-account-data.ts, features/accounts/README.md,
lib/db/database.ts, lib/db/schema.ts, lib/db/README.md, lib/query/keys.ts,
lib/repositories/reviews.ts, features/reviews/approval-mutations.ts.

The existing account detail route stays small and unchanged. Accounts list and
Overview UI are unchanged by this completion.

## Files in this milestone

Created:
- app/accounts/[accountId]/page.tsx
- features/accounts/accounts-model.ts
- features/accounts/accounts-columns.tsx
- features/accounts/accounts-table.tsx
- features/accounts/accounts-workspace.tsx
- features/accounts/account-detail-workspace.tsx
- features/accounts/account-detail-sections.tsx
- features/accounts/account-query-state.tsx
- features/accounts/use-account-data.ts
- features/accounts/README.md
- lib/repositories/contacts.ts
- tests/accounts.test.ts

Modified:
- app/accounts/page.tsx
- components/layout/app-header.tsx (nested account route context only)
- lib/repositories/proposals.ts (account-scoped history read)
- lib/query/keys.ts (contact and account-proposal keys)
- features/reviews/approval-mutations.ts (contact invalidation)
