# Favorites

Favorites reference individual accounts, contacts and persisted deals. They are
separate from Saved Views, which remain an unimplemented sidebar placeholder.

The repository validates references on add, uses idempotent set/remove operations
and enforces uniqueness with a compound IndexedDB index. Missing references stay
visible as unavailable records with a remove control, rather than broken links.
Demo reset clears favorites; regular reloads and schema upgrades preserve them.

TanStack Query owns the shared favorite list. Mutations optimistically patch one
record and restore that record on failure without losing simultaneous changes to
other favorites. Same-record writes are guarded while pending. Star controls show
save errors and the sidebar updates from the same cache immediately.

Account, Contact and Deal detail headers expose stars. Deal favorites navigate directly to `/workspace/deals/[dealId]`. The sidebar shows the latest
five favorites, and a native dialog offers all favorites when more exist.
Existing account/contact/deal query caches resolve labels without duplicating
entity fetching or copying names into storage. No new packages are required.

