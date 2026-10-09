# Contacts

`/contacts` reads validated local contacts through `contactRepository.getAll()` and
the `contacts.list` query cache. Accounts, deals, activities and pending proposals
reuse existing hooks and cache keys. Review writes already invalidate the contacts
prefix, including this list. React components never import Dexie or seed JSON.

Search matches every term across full name, role, email and account name. Exact
status, account-ID and region filters combine with search and single-column sorting.
Missing regions have a separate option. Derived numeric columns sort numerically.
Native contact and account links support Enter, modified clicks and browser back.
Tab, J/K, arrows and Home/End navigate contact names. Existing workspace shortcuts
pause while typing. Sticky headers and horizontal scrolling retain compact columns.

Region and open-deal count come from the account. Both terminal deal stages are
excluded. Counts repeat across contacts at the same account; they do not claim
individual deal ownership. Last Activity only includes activities at that account
whose participant IDs contain this contact. Pending Reviews counts distinct Pending
or PartiallyApproved proposals with unresolved changes targeting the contact.

`/contacts/[contactId]` adds account-scoped proposal and audit reads using existing
hooks. The existing account projection resolves relationships once; the contact
projection narrows activity to participation, opportunities to those referenced by
that activity, diffs to this contact, and audit to direct contact events or proposal
state events involving this contact. Proposal source evidence remains available even
if the source activity does not list the contact as a participant. Mixed proposals
show only this person's field changes. Partially reviewed proposals can appear in
both pending and reviewed sections, with the relevant fields in each.

Opportunity buttons open the shared accessible preview dialog. Account links use
the existing account-detail route. Missing contacts, absent relationships, empty
lists, loading, read errors and refresh errors have explicit states. No edits,
new entities, database migrations, seed changes, dependencies or remote APIs.

Created:
- app/contacts/[contactId]/page.tsx
- features/contacts/contacts-model.ts
- features/contacts/contact-detail-model.ts
- features/contacts/contacts-columns.tsx
- features/contacts/contacts-table.tsx
- features/contacts/contacts-workspace.tsx
- features/contacts/contact-detail-workspace.tsx
- features/contacts/contact-proposals.tsx
- features/contacts/contacts-query-state.tsx
- features/contacts/use-contacts.ts
- features/contacts/README.md
- tests/contacts.test.ts

Modified:
- app/contacts/page.tsx
- lib/repositories/contacts.ts (validated getAll)
- lib/query/keys.ts (contact list key)
- components/layout/app-header.tsx (nested contact route context only)

Accounts UI, Overview and Global Search are unchanged.
