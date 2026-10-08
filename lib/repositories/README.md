# Repositories

Feature hooks import `dealRepository`, `accountRepository`, or
`proposalRepository`. Their interfaces return plain domain objects and promises;
UI code does not need Dexie, IndexedDB, or seed JSON imports.

- Deals: `getAll`, `getById`, `update`.
- Accounts: `getAll`, `getById`. No account mutation is needed yet.
- Proposals: `getPending` (oldest first), `getById`, `updateStatus`, `updateChanges`.

`getById` returns `undefined` when missing. Mutations throw when missing, return
the persisted record, validate with existing Zod schemas, and update within a
transaction. Deal patches cannot change identity or account membership. Fields
omitted from a patch are preserved; optional deal fields can be cleared with
`undefined`. Proposal status and change-array writes preserve other fields.

These are data-access operations, not an approval engine. Updating proposal
status does not apply its changes to CRM records. Approval rules, stale-value
checks, audit, and undo will belong to the later review workflow.

Factories accept an optional database for isolated integration tests. Shared
exports resolve the shared database lazily and await workspace initialization
on every operation. Importing a repository does not initialize IndexedDB during
SSR; methods must run client-side. Storage errors propagate to callers.

No base class, generic CRUD framework, create/delete operations, or new packages
were introduced. Interfaces provide a small boundary for feature hooks and mocks.

