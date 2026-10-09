# DealPatch roadmap

## Completed foundation

- Shell, domain models, fictional data, IndexedDB and repository/query layers.
- Pipeline, Accounts, Contacts, Deal Detail and Review Queue.
- Edit, partial approval, conflict detection, optimistic writes, safe Undo and audit.
- Activity → deterministic simulated analysis → review proposal.
- Global Search, Favorites and Pipeline Saved Views.
- Workflow validation, performance and accessibility hardening.
- Four-mode theme architecture and premium workspace UI polish.

## Completed showcase milestone

Public landing/showcase at `/`, with the existing product under `/workspace`.
Shared themes, an illustrative review preview, educational positioning, project
links, responsive screenshot baselines and accessibility checks. Workspace screens
and the data model are not redesigned.

Validated with typecheck, lint, 148 unit tests, production build and 50 Playwright
tests. Landing snapshots cover four themes on desktop/mobile; the existing 26
workspace baselines pass without regeneration.

## Release hardening

Clean-install, repository, documentation, dependency and cross-browser validation
is recorded in [Release readiness](RELEASE_READINESS.md). This prepares a release;
it does not publish or deploy one.

## Later, only when requested

Publishing/deployment and the engineering case study require a separate request.

## Outside V1

Authentication, remote AI providers, external databases, email/calendar integrations,
multi-user collaboration and billing.
