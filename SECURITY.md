# DealPatch security review

Reviewed 2026-10-08. Scope: application source, seed imports, repository mutations,
browser storage, Next.js response configuration, and installed npm dependencies.
This is a source and configuration review, not a penetration-test certification.

## Findings and protections

- No application `dangerouslySetInnerHTML`, raw HTML insertion, dynamic code
  evaluation, or external script loading was found. Review values and evidence
  render as React text. Regression tests cover HTML-like payloads.
- Navigation URLs are fixed internal paths. Account website imports accept only
  HTTP(S), and website values are not currently rendered as links. Revalidate at
  the navigation boundary if external links are introduced; use `rel="noopener
  noreferrer"` for new-tab links. Do not treat a schema as URL-sink protection for
  arbitrary values read directly from storage.
- Initial seed and explicit reset both use strict Zod schemas, including IDs,
  relationships, current-value snapshots and source evidence. Fields cannot target
  inherited properties such as `__proto__` or `constructor`.
- Review writes validate schemas, check account ownership and stale values, and
  use atomic IndexedDB transactions. These protect demo integrity, not access
  control. Simulation has no network client or external intelligence service.
- A filename/pattern scan of repository files (including ignored documentation,
  excluding dependencies, build artifacts and Git internals) found no environment
  files, private-key files, or common credential patterns. This cannot prove that
  arbitrary secrets are absent; Git history and external systems were not audited.

## HTTP configuration

`next.config.ts` adds headers for all paths:

| Header | Value / purpose |
| --- | --- |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY`; embedding this app in frames is intentionally blocked |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | Disable camera, microphone, geolocation, payment and USB |
| Cross-Origin-Opener-Policy | `same-origin`; cross-origin opener relationships are isolated |

The Next.js powered-by header is disabled. No permissive CORS rule was added.
HSTS is deferred to an HTTPS deployment edge after the actual domain and TLS
setup are verified; localhost HTTP remains supported. Do not enable includeSubDomains
or preload without checking every affected host.

No CSP was added. The app currently uses statically prerendered App Router pages
and Turbopack. A strict script policy needs a verified runtime-aware nonce or hash
design for framework inline scripts, streamed payloads, and styles. A static nonce
or adding `unsafe-inline` and claiming strict protection would be misleading.
See [Next.js CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).
Headers must be rechecked if deployment changes to a static-file host or a proxy
that overrides response headers.

## Remaining concerns

1. **Development dependency advisory:** full `npm audit` reports five high-severity
   affected packages through `eslint-config-next → @next/eslint-plugin-next →
   fast-glob → micromatch → braces@3.0.3`. These represent one underlying
   [stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
   The registry currently reports 3.0.3 as the latest braces release. npm suggests
   downgrading eslint-config-next to 14.2.35, a major version mismatch with Next 16;
   that change was not applied. Production-only audit reports zero vulnerabilities.
   Avoid feeding attacker-controlled glob patterns into lint tooling and recheck
   for a compatible upstream fix. An audit is a point-in-time check, not proof that
   dependencies have no vulnerabilities.
2. **Browser storage is not a trust boundary:** workspace data has no app-level
   encryption or user separation. Same-origin scripts, browser tools and extensions
   with sufficient access can read or modify it. Use fictional data only and a
   dedicated deployment origin; do not colocate untrusted applications on it.
3. **Stored reads are not universally runtime-validated:** repositories return
   typed IndexedDB records directly. Corrupt/tampered records can break rendering
   (for example invalid timestamps) or mislead the UI. Write validation does not
   make storage tamper-proof. A future import or migration boundary must validate
   records; there is no external import feature today.
4. **Local persistence is not a backup:** browser clearing/eviction can remove
   data. Reset deliberately discards local edits. Query caches in other tabs may
   lag until refetch, although transactional stale-value checks protect writes.
5. **No strict CSP or enforced HTTPS/HSTS yet:** these remain deployment work,
   rather than silently changing static rendering or breaking local development.
   Keep development servers local; their default network binding is not a public
   deployment configuration.

No authentication, backend, external services or packages were added.

## Verification

- `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed.
- Seed, persistence and review suites passed: 28 tests, including unsafe URL
  rejection, inherited-field rejection and escaped HTML rendering.
- Live production HTTP checks verified all five headers and the absence of
  `X-Powered-By` on six application routes, the favicon and a 404 response.
  A Next.js JavaScript runtime asset returned HTTP 200 with `nosniff`.
- Full `npm audit --json` exited 1 with the five development-tool findings above;
  `npm audit --omit=dev` exited 0 with zero vulnerabilities. No audit findings were
  suppressed and no major dependency downgrade was applied.
