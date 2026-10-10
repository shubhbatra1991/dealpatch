# GitHub and supply-chain security

DealPatch is an educational, local-first project. These controls protect source
and contribution workflows; they do not add runtime services or make the demo a
production CRM. No repository settings have been changed or verified remotely.

## Public-repository boundary

Everything committed to the public DealPatch repository must be treated as public.
This includes Git history, documentation, seed fixtures and screenshots, not only
application code. Never commit API keys, credentials, signing keys, private
infrastructure configuration, production secrets or real customer data.

Future production secrets belong in deployment-platform settings such as Vercel
environment variables, with server-only access. Browser-exposed configuration is
public and must never contain secrets. Any future private infrastructure belongs
outside this public application repository. V1 still requires no secrets, external
runtime services or environment configuration. See the canonical
[security policy](../SECURITY.md) for disclosure and local-storage limitations.

## Configured in the repository

### CI and release validation

`.github/workflows/ci.yml` runs on every pull request and push to `main`.
The **Build and browser checks** job uses Ubuntu, Node.js 24 and the npm download
cache keyed by `package-lock.json`. It runs:

```sh
npm ci
npm run check:repository
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Only Chromium and its system dependencies are installed for ordinary CI. Browser
checks use the existing production server and real IndexedDB:

- All four release smoke cases: clean workflow/persistence, reset, invalid data
  and unavailable IndexedDB.
- All eleven Review Queue cases, including the golden path, conflict, rollback,
  partial approval, Undo and keyboard behavior.
- Six landing interaction cases, including tabs, reduced motion and all-theme axe.
- Three accessibility smoke cases: Review Queue route, command palette/editor,
  reduced motion/forced colors.
- The landing mouse-wheel and keyboard scrolling regression.

The workflow's **Run workflow** (`workflow_dispatch`) mode instead uses Windows
and installs Chromium, Firefox and WebKit, then runs `npm run test:e2e` in full.
Windows matches the committed `win32` screenshot baseline platform. The full
accessibility, theme, visual and stress suites are intentionally excluded from
normal PR smoke to keep feedback reasonably fast. Before release, run the manual
full job on the reviewed `main` commit or the full commands locally on Windows.
Do not update baselines automatically to make CI pass. Hosted runner/font
differences still need investigation if visual comparisons fail.

Jobs have bounded timeouts; superseded CI/CodeQL runs are cancelled. Only failed
runs upload available browser traces, screenshots and reports, retained for seven
days. Artifacts use fictional data but should still be reviewed before sharing.

### CodeQL and dependency review

- `codeql.yml`: PRs and `main` pushes; **Analyze JavaScript and TypeScript** uses
  `javascript-typescript`, build mode `none`, and the default CodeQL security
  queries. Source analysis does not need dependency installation or app execution.
- `dependency-review.yml`: PRs; **Review dependency changes** fails on introduced
  known high/critical vulnerabilities across the action's default scopes. It has
  no advisory allowlist and posts no PR comment. Unchanged documented tooling
  advisories are not broadly exempted: a new vulnerable dependency/version can
  still block a PR and needs review.
- `dependabot.yml`: weekly npm and GitHub Actions checks, with five/three open
  version-update PR limits. Patch/minor version updates are grouped per ecosystem;
  major updates remain separate. Grouping is a review convenience, not a safety
  guarantee. No auto-merge is configured.

Dependency review requires GitHub's dependency graph. CodeQL uploads need code
scanning available and advanced setup selected; do not run conflicting default
and advanced CodeQL setups. Availability can differ for private repositories.
See [CodeQL setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning)
and [dependency review](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action).

### Permissions and action pins

Every workflow defaults to `contents: read`. Only the CodeQL analysis job adds
`security-events: write` to upload findings. No workflow requests content, package
or pull-request write access. Checkout disables credential persistence. PR checks
use `pull_request`, never `pull_request_target`, and no repository secrets or
self-hosted runners are needed. Fork PRs may require maintainer approval to run;
do not weaken event/token isolation to bypass that.

All action references are official GitHub actions pinned to full immutable commit
SHAs, with human-readable release comments. Pins were resolved from upstream Git
tags, peeling the annotated CodeQL tag to a commit:

| Action | Release | Commit |
| --- | --- | --- |
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/upload-artifact | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| github/codeql-action | v4.38.3 | `24c54180a607b1449ed407dd24f251e4e9147c8d` |
| actions/dependency-review-action | v5.0.0 | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` |

Review Dependabot's pin changes and upstream release notes before merging. Pinning
the action code does not freeze its downloaded CodeQL bundle, browser runtimes,
runner image or Node 24 patch release. `npm ci` verifies the committed lockfile;
installation lifecycle scripts still execute code and should only run in isolated
CI or a trusted checkout. No signing or package publishing is introduced.

## Recommended GitHub UI settings — not verified or enabled here

### Dependency Review prerequisite and failed-run recovery

If **Review dependency changes** fails with “Dependency review is not supported
on this repository”, check the repository's Dependency graph setting first. The
action requires that feature; adding token permissions or ignoring the failure
does not enable it.

A repository administrator must open
[DealPatch security settings](https://github.com/shubhbatra1991/dealpatch/settings/security_analysis),
then **Advanced Security → Dependency Graph → Enable** (older GitHub layouts may
call the page **Code security and analysis**). See
[GitHub's Dependency graph instructions](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/enable-dependency-graph).
Allow the manifest/lockfile graph to populate, then rerun the failed Dependency
Review job. If the repository is private, also verify that dependency review is
available for its plan/security configuration. No setting has been enabled or
verified from this checkout.

Keep `fail-on-severity: high`, read-only permissions and the required check. Do
not use `continue-on-error`, skip the action, or enable automatic merging to make
an unavailable security control appear successful.

If CI reports missing lockfile entries, regenerate `package-lock.json` with the
npm version that reproduces the hosted error, then validate a clean install with
that version before committing. npm 11.6.2 accepted the incomplete optional WASM
graph that npm 12.2.0 rejected for missing `@emnapi/core` and `@emnapi/runtime`
1.11.3 entries. A plain npm 11 lockfile-only install did not repair those entries;
npm 12 regeneration in an isolated directory without installed modules did.
Commit the repaired lockfile and rerun CI on that commit; rerunning an old commit
will continue to use its broken lockfile. Keep `npm ci` in CI.

For `shubhbatra1991/dealpatch`, enable where available:

- Secret scanning and push protection.
- Dependency graph, Dependabot alerts and Dependabot security updates.
- Private vulnerability reporting, matching the root [security policy](../SECURITY.md).
- Code scanning advanced setup for the checked-in CodeQL workflow.
- Actions restricted to approved actions, full-SHA pins, read-only default token
  permissions and approval for untrusted fork contributors.

For `main`, create branch protection or a ruleset that requires a PR and status
checks, conversation resolution, blocks force pushes and branch deletion, and
limits bypasses. Consider requiring an up-to-date branch after evaluating queue
cost. Required check names must match the first actual hosted run:

- **Build and browser checks** (CI).
- **Analyze JavaScript and TypeScript** (CodeQL).
- **Review dependency changes** (Dependency Review; PRs only).

CODEOWNERS uses `@shubhbatra1991`, taken from the origin remote, not local machine
identity. A code-owner review requirement is optional and needs an eligible
reviewer; requiring self-approval can block a sole maintainer. CODEOWNERS alone
does not enforce branch protection. Confirm these settings manually after pushing
and the initial hosted workflow runs; local validation cannot certify GitHub API
permissions, organization policies or checks being required.

## Dependency and secret policy

Never commit credentials or API keys. No `.env` file, secret-management service or
runtime credentials are required. `.gitignore` excludes environment files, private
key containers, common local cloud/SSH credentials and generated artifacts, while
intentional screenshot baselines remain tracked. `npm run check:repository`
checks candidate files for generated artifacts, high-signal credential signatures,
personal Markdown paths and broken documentation links. This heuristic scan is
not comprehensive secret detection and does not audit Git history. If a secret
is exposed, revoke/rotate it first and follow private disclosure guidance.

Audit rechecked 9 October 2026: `npm audit --omit=dev` has zero findings. Full
`npm audit` exits nonzero with five high-severity affected packages in the existing
Next ESLint → fast-glob → micromatch → braces development chain. The retained
decision and advisory are documented in [SECURITY.md](../SECURITY.md). No forced
fix, tooling downgrade or global advisory exemption is applied. New dependency
changes are reviewed separately; audit results change as advisories are published.

Node.js 24 is the expected toolchain. `setup-node` uses the npm bundled with the
selected Node patch, so its npm major version can change; CI logs both versions.
The lockfile is committed and must validate with the hosted npm version, not just
the local one (Node 24.19.0 / npm 11.6.2 locally, npm 12.2.0 also validated).
`main` is the supported
development branch, not a promise of historical release support. There is no
automatic merge, publish or deployment workflow. Review full validation and audit
results before manually preparing a release.

## Local validation — 9 October 2026

Clean `npm ci`, typecheck, lint (no warnings), 150 unit tests, production build
and all 70 Playwright cases passed (62 Chromium, four Firefox, four WebKit).
The final production audit reports zero vulnerabilities; full audit retains the
five documented development findings. No package or lockfile changes were made.

All four YAML files parsed using the installed `js-yaml` parser. Workflow action
references were checked for full SHAs and npm script references against
`package.json`; smoke discovery selected 21 release/review/landing cases, three
accessibility cases and one scrolling case. Eighteen synthetic sensitive/generated
path examples were verified ignored while an intentional baseline remained
trackable. Repository hygiene and diff whitespace checks passed.

This is local Windows validation, not a successful hosted CI/CodeQL/dependency
review run or Ubuntu execution claim. Confirm the first GitHub runs and configure
required checks manually after these files are published. No push, deployment or
repository-setting change was performed.

## Hosted clean-install failure repair — 10 October 2026

Reproduced the reported missing `@emnapi/core` / `@emnapi/runtime` 1.11.3 error
with npm 12.2.0. Regenerated the lockfile's optional/bundled dependency metadata
with that npm version in an isolated directory. Existing locked package versions
and `package.json` are unchanged. npm 12 clean installation now succeeds; npm 11
validation and npm 12's Linux x64 dry-run plan also pass. The Linux plan is not an
actual Ubuntu execution result.

After clean installation, typecheck, lint, all 150 unit tests, production build
and all 25 ordinary CI Chromium smoke checks pass. Production audit has zero
findings; the five documented development-tool findings remain. npm 12 reports
that the unapproved `unrs-resolver` postinstall script was blocked; no broad script
approval was added, and lint/build still pass with the installed platform binding.
The CI workflow now reports Node/npm versions before `npm ci`.

Dependency Review's reported unsupported-repository error still requires an
administrator to enable Dependency Graph using the settings instructions above,
wait for graph population, and rerun the job. The vulnerability threshold and
workflow permissions are unchanged. GitHub settings and hosted check success
have not been verified from this checkout.

## Boundary review and revalidation — 10 October 2026

Reviewed and retained all six existing `.github` files; no duplicate workflows or
additional permissions were needed. The canonical policy, security principles and
this guide now explicitly treat all committed material as public, prohibit keys,
credentials, private infrastructure, production secrets and real customer data,
and place future secrets in server-only deployment settings (for example Vercel
environment variables). Future private infrastructure belongs outside this repo.

Clean installation initially hit a Windows native-module lock from the running
development server; stopping the verified project processes allowed `npm ci` to
complete. Typecheck, lint, 150 unit tests and production build passed. The first
full browser run found an End/Home test synchronization issue (69 passed, one
failed): footer visibility did not guarantee native End scrolling had finished.
The test now waits for `scrollend`, with no app change, retry or arbitrary sleep.
Three repeated scrolling tests and the final full 70-test suite passed.
`npm audit --omit=dev` reports zero vulnerabilities; installation still reports
the five documented development-tool findings. YAML/pin/script checks and
repository hygiene checks passed. GitHub UI settings and hosted runs remain
unverified; no publication or settings change was performed.
