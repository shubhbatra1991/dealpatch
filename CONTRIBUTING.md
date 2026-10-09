# Contributing to DealPatch

DealPatch is an educational, local-first workspace with fictional data. Start
with [AGENTS.md](AGENTS.md), [architecture](docs/ARCHITECTURE.md),
[engineering rules](docs/ENGINEERING_RULES.md) and [design](docs/DESIGN_SYSTEM.md).

Use Node.js 24 (the validated runtime) and npm. Clone the repository, then run
`npm install` and `npm run dev`. No credentials, `.env`, database setup or accounts
are needed. See [README](README.md) for product routes.

Before opening a pull request, run:

```sh
npm ci
npm run check:repository
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

Install browser runtimes once with `npx playwright install chromium firefox webkit`.
See [browser tests](tests/e2e/README.md) for platform-specific screenshots and smoke
coverage. Do not regenerate baselines merely to hide a regression.

Keep routes small, logic feature-local and domain types framework-independent.
React components use repositories/query hooks, never Dexie directly. New
dependencies require a concrete need, compatibility review and explanation in the
PR. Do not add auth, external services or credentials to V1.

Preserve keyboard behavior, visible focus, semantic HTML, accessible labels and
reduced-motion/forced-colors support. Run relevant axe and large-data checks when
changing shared controls, tables or review behavior.

PRs should explain the problem, resulting behavior, validation and remaining
limitations. Include fictional screenshots for visible changes. Keep unrelated
refactors out. Never include local databases, generated artifacts or credentials.
Report security issues through [SECURITY.md](SECURITY.md).
