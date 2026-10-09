# Deal Detail

`/workspace/deals/[dealId]` is the local opportunity workspace. The route only resolves the async route parameter; the feature owns queries and presentation.

The feature reuses Contacts’ core entity queries and account-scoped proposal/audit queries. They share the existing caches and review invalidation, including optimistic deal updates. No new table, repository, dependency or seed data is needed.

`buildDealDetail` narrows the existing account projection. Activities must match both account and deal. Contacts must belong to the account and appear as participants in those activities; account-only contacts are not inferred as opportunity contacts. Proposals must reference the deal or explicitly target it. Audit history includes this deal’s field events and related proposal state events, excluding sibling records’ field events. Mixed proposal snapshots are labelled as such.

Health uses existing risk, the latest of stored last-activity and related activity timestamps, a 14-day stale threshold, UTC calendar close dates, blank next steps, probability below 30%, and unresolved review count. Overdue/stale/missing-next-step/low-probability signals apply to open opportunities. These are transparent attention rules, not an invented score. Current time refreshes every minute.

Overview, Activity, Contacts, Reviews and Changes use roving keyboard tabs (Left/Right, Home/End). Read failures retain available cached content and expose Retry. Unknown local IDs show a useful not-found state. Review changes show live current values, proposed values, immutable captured values and stale warnings; editing/approval remains in Review Queue. Audit events are read-only, and undo remains visible as its own event.

Pipeline deal names, Open deal, row double-click and the highlighted-row Enter shortcut navigate to the dedicated route. Checkbox selection and virtualized navigation remain intact. Search and Favorites use the same encoded deal URL. Legacy Pipeline highlight URLs remain accepted for existing links.
