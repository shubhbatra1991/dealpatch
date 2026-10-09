# Local workspace persistence

Dexie 4 wraps the browser IndexedDB database `dealpatch`. Schema version 1 has
five stores with string primary keys: accounts, contacts, deals, activities,
and proposals. Domain models contain no persistence implementation details.
Version 2 preserves those stores and adds `auditEvents`, indexed by target entity,
proposal, and event time. Existing workspaces upgrade without reset or backfill.
Dexie was added for typed stores, schema migrations, and atomic transactions.
Version 3 adds `favorites`, with a unique compound entity-type/entity-ID index.
It preserves all existing records and starts with no favorites. Favorites store
references only; names are resolved through the existing entity queries.
Version 4 adds `savedViews` for Pipeline configurations only. Upgrades preserve
favorites, business records and audit history. No saved views are seeded, and
explicit demo reset clears them along with the other local stores.
`fake-indexeddb` is a development-only dependency for persistence tests.

`getDatabase()` creates the shared instance lazily in a browser. Module imports
and server rendering do not create or open a database. The application shell's
client initializer calls `initializeWorkspace()` from an effect and gates page
content until storage is ready. Failed initialization shows a retry action.

Initialization checks all stores, including audit history. If any record exists, it preserves the
workspace without importing seed JSON. A completely empty database loads and
validates the seed snapshot, then checks emptiness again inside a read/write
transaction before inserting. Concurrent tabs and React Strict Mode are safe.
A failed insert rolls back every store; retrying can seed again. Partial local
data is preserved, not repaired or overwritten automatically. Clearing every
store manually makes the workspace eligible for seeding again.

JSON is loaded only by the database seed module for initialization or explicit
reset. Feature repositories should await initialization before reading or
writing the database; components must never import Dexie or seed JSON directly.

## Reset during development

Call the exported function from browser-side development code:

```ts
import { resetWorkspace } from "@/lib/db/workspace";

await resetWorkspace();
window.location.reload();
```

This deliberately discards local edits, generated proposals, favorites, saved views
and audit history, then replaces the five business stores with the
validated seed snapshot in one transaction. A failed reset restores the prior
workspace. Reload after reset to refresh any mounted views or future caches.
No reset occurs automatically after errors or schema changes.

Review approvals, suggestion edits, rejections and undo append validated audit
events inside the same write transaction as their business changes. The application
audit repository exposes only account-scoped reads. No old audit events are updated
or deleted during normal review/undo. Demo reset is the explicit development-only
exception; local browser storage remains user-editable and is not tamper-proof.

Add a new Dexie version and an explicit migration when the schema changes;
do not modify the published version 1 definition or delete the database.

Run `npm run test:db` for persistence, concurrent initialization, rollback,
reset, and SSR-guard checks. These tests use an in-memory IndexedDB implementation;
they do not access or reset the browser workspace.
