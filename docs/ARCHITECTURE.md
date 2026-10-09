# Architecture

## Main layers

app/
Routing and page composition only.

- `app/layout.tsx`: shared document, theme bootstrap and global styles.
- `app/page.tsx`: public showcase and social metadata.
- `app/workspace/layout.tsx`: QueryProvider, AppShell, keyboard/search overlays,
  notifications and client-only workspace initialization.
- `app/workspace/**/page.tsx`: small compositions of existing workspace features.

The public `/` showcase does not initialize IndexedDB or mount workspace providers.
`features/landing` contains static server-rendered sections and an illustrative
review preview. Only the shared ThemeControl needs client state. Workspace CTA
links disable prefetch so viewing the showcase does not preload the product.

Both layers share semantic tokens and theme bootstrap. Landing CSS is scoped under
`.landing`; workspace geometry is unchanged. `lib/project.ts` configures public
source/docs/security/license links, with no environment variables or invented origin.

CRM links use `/workspace/...`, including search, favorites, saved-view query
parameters and proposal/activity deep links. IDs remain URL-encoded. IndexedDB
name/schema and theme storage keys are unchanged, preserving local work through
the migration. Review history remains inside the Review Queue, without a new
history route. Old root workspace paths are intentionally not redirected.

features/
Feature-specific UI, hooks, and logic.

components/
Reusable cross-feature UI.

domain/
Framework-independent domain models and validation.

lib/db/
IndexedDB and Dexie implementation.

lib/repositories/
Data-access abstraction.

lib/query/
TanStack Query configuration and query keys.

lib/simulation/
Simulated intelligence workflows.

store/
Transient Zustand UI state only.

data/seed/
Initial fictional demo data.


React components must not access Dexie directly.

UI components should consume repositories through feature hooks.

Domain types must not depend on React or Next.js.

Seed JSON must not become the runtime source of truth.

## Showcase performance boundary

The landing page is statically rendered. Its only feature-specific client state
is the existing theme selector; the illustrative review never imports queries,
repositories, Dexie, simulation or workspace tables. Browser tests assert that
IndexedDB has no databases before workspace entry. CTA prefetch is disabled.

Production build inspection on 9 October 2026 found eight script tags for `/`
(577,232 raw bytes / 177,463 summed gzip bytes) versus fourteen for `/workspace`
(1,204,563 / 341,072). This counts the unique local JS files referenced by each
generated HTML document, including framework/polyfill chunks; Python gzip was
applied to each file independently. It is not an interaction benchmark or actual
network transfer measurement. Landing scripts contain no Dexie marker. The
framework remains the largest baseline cost; no dependencies were added.
