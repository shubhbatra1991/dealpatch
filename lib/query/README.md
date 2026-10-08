# Query state

TanStack Query 5 owns the asynchronous read cache and future mutation state.
IndexedDB remains durable storage; Zustand is reserved for transient UI state.
No additional cache persistence plugin or Zustand data store is needed.

The root layout mounts `QueryProvider` above the shell and workspace initializer.
It creates a stable client per provider using lazy React state, so server renders
do not share a global cache. Query hooks explicitly disable automatic fetching
on the server; the existing workspace gate opens storage only after mount.

Feature hooks: `useDeals`, `useAccounts`, `usePendingProposals`. They expose the
standard typed TanStack Query results, including pending, error, data, and refetch
state. Their query functions call repositories, never Dexie or JSON directly.
Query options are exported alongside hooks for reuse and testing.

Keys live in `keys.ts`. Entity roots can invalidate all related queries; list
and pending keys identify the current read shapes. Add detail/filter keys when
those query shapes exist rather than adding unused keys now.

Defaults: 30-second freshness, no automatic retries for local storage errors,
and `networkMode: "always"` for reads and mutations so local work remains usable
without network connectivity. Default focus/reconnect behavior is retained.

Future write hooks should use `useMutation` around repository operations and
invalidate the relevant entity keys after success. Optimistic updates belong
in Query's cache, not Zustand. No write hooks are added before a UI uses them.
After a developer reset, reload the workspace as documented in `lib/db/README.md`.

`@tanstack/react-query` is the only new dependency. Run `npm run test:query` for
repository delegation, cache isolation, invalidation, offline operation, and SSR.
