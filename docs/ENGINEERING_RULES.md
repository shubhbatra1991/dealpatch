# Engineering Rules

## TypeScript

- Do not use `any` unless unavoidable and documented.
- Prefer explicit domain types.
- Keep shared types close to their domain.

## React

- Prefer composition over large components.
- Avoid unnecessary useEffect.
- Do not store derived state.
- Do not put server/data state into Zustand.
- Avoid unnecessary memoization.

## State ownership

TanStack Query:
Persistent data and mutations.

Zustand:
Transient application UI state.

URL:
Shareable filters and navigation state.

React local state:
Component-local interaction state.

IndexedDB:
Local persistence.

## Dependencies

Before adding a package:

1. Verify the functionality is not trivial to implement.
2. Verify the package is actively maintained.
3. Verify it is compatible with the project.
4. Avoid overlapping packages.
5. Document why it was added.