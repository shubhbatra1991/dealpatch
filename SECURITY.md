# Security policy

## Supported scope

The latest DealPatch source is an educational, local-first demo using fictional
data. No historical release support, authentication, user isolation, remote
backend or production CRM security guarantees are provided.

## Reporting an issue

Use the repository's **Security → Report a vulnerability** option if enabled.
Otherwise open a minimal [GitHub issue](https://github.com/shubhbatra1991/dealpatch/issues)
requesting a private reporting channel. Do not post exploit details, credentials,
personal data or real customer records in public. Include affected version/commit,
impact and safe reproduction information once a suitable channel is established.
No personal email or response-time guarantee is published.

## Local-first limitations

IndexedDB is persistence, not encrypted storage, authorization or a backup.
Same-origin scripts, sufficiently privileged extensions and browser tools can
access or modify data. Browser eviction/clearing can remove local work. Use
fictional data only; do not place this demo on an origin shared with untrusted apps.
Writes validate domain rules and stale values inside transactions. Runtime reads
validate records at repository boundaries, but this is not tamper-proof storage.
Cross-tab query caches can lag; persisted-value checks protect review writes.

Explicit demo reset discards edits, generated proposals, favorites, saved views
and audit history, restoring the original five business collections atomically.
Normal Undo appends an audit event and does not delete history. Reset is a developer
function, not a visible product button; see [persistence](lib/db/README.md).

Security headers are configured in `next.config.ts`. Strict CSP and HTTPS/HSTS
remain deployment-specific work. No third-party application services are used;
GitHub links are intentional navigation. npm/browser installation downloads are
setup traffic, not workspace data transmission. Keep development servers local.

## Known dependency risk

On 9 October 2026, `npm audit --omit=dev` reports zero vulnerabilities. Full audit
reports five high-severity affected packages from one development chain:
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
The [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
has no patched version listed. npm suggests downgrading the Next lint config to
14.2.35, incompatible with this project's Next 16 tooling. That downgrade and
`npm audit fix --force` are not applied. This is an explicitly retained development
risk: lint only trusted repository patterns and revisit upstream fixes. Do not
interpret a zero production audit as proof of complete security.

See [security principles](docs/SECURITY.md) and
[release readiness](docs/RELEASE_READINESS.md) for current checks and limitations.
