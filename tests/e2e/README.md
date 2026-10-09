# Review Queue browser validation

Install dependencies with `npm install`, then install the test browser once:

```sh
npx playwright install chromium
npm run build
npx playwright test
```

`npm run test:e2e` is an alias for the last command. Playwright starts and stops
the production server on port 3100. It intentionally refuses to reuse a server,
so a developer's running workspace is never reset. Run the build before tests;
the suite does not rebuild or run against a potentially stale development server.

Each test receives an isolated Chromium context. The fixture clears every native
IndexedDB table and reloads to exercise the application's normal seed initializer.
No repository, query, simulation, or IndexedDB implementation is mocked.

The golden path removes only `proposal_001` during setup, allowing the original
fictional `activity_003` to generate a fresh proposal through the real simulator.
Conflict tests modify the seeded deal through native IndexedDB to represent a
second local writer. Assertions use visible UI behavior rather than stored data.
The storage-abort test temporarily intercepts the first native audit insert and
aborts its real transaction. This is the only fault injection; it verifies atomic
rollback after the entity write and restores the native method before retrying.

The suite covers approval, partial approval, edited values and validation,
rejection, stale detection, atomic rollback after a concurrent edit, safe Undo,
Undo conflicts, pending badges, reload persistence, Deal Detail/audit navigation,
keyboard movement, focus restoration, and shortcuts while typing. The golden
path also checks duplicate protection when returning to the source activity.

Failure traces/screenshots and the HTML report are ignored generated artifacts.
Inspect with `npx playwright show-report`. Tests run without retries so failures
are visible instead of hidden. Chromium is the initial browser target; this is
not a claim of Firefox, WebKit, or assistive technology certification.

## Validation recorded 9 October 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 131 passed |
| `npm run build` | Passed |
| `npx playwright test` | 11 passed, no retries |

Manual browser checks on a separate production origin verified visible focus,
Arrow/J navigation, Enter/Escape dialog behavior and restored focus, A/R review
shortcuts, invalid edits, partial/full/rejected status transitions, immediate
badge changes, and Undo. Captured conflict and rollback screens were also
manually inspected: captured 20%, current 35%, proposed 45%, disabled unsafe
approval, and the explicit rollback notification were visible and readable.

No functional application bugs were found or runtime code changed in this task.
An initial lint failure was a fixture callback named `use` being mistaken for a
React hook; renaming the callback fixed it without suppressing lint rules.
The singular "1 changes" copy issue recorded here was corrected in the following
performance-hardening milestone; see `docs/PERFORMANCE.md` for that validation.

Remaining limits: browser coverage is Chromium only; Undo receipts remain
session-scoped (the persistence assertions cover CRM values, proposals and audit
history, not Undo surviving reload). Installation audit reported five high
severity findings in the existing `eslint-config-next` / `fast-glob` /
`micromatch` / `braces` development dependency chain. No Playwright advisory was
reported. No forced downgrade or unrelated dependency changes were made.
