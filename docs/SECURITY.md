# DealPatch Security Principles

## 1. Scope

DealPatch V1 is an open-source, local-first B2B sales workspace.

The V1 application:

- contains no real customer data
- requires no external credentials
- requires no environment variables
- performs no authentication
- uses local IndexedDB storage
- makes no external AI requests
- does not depend on a remote backend
- does not provide multi-user isolation

The security model is intentionally limited to the needs of a local demo/workspace application.

---

## 2. Core Security Rules

DealPatch must:

- never commit secrets, tokens, API keys, or credentials
- never embed secrets in client-side JavaScript
- never render untrusted HTML
- avoid `dangerouslySetInnerHTML`
- validate imported and seeded data before persistence
- validate important mutation payloads before writes
- treat external URLs as untrusted input if introduced later
- avoid unnecessary third-party scripts
- minimize dependencies
- use security headers in deployed environments
- regularly run dependency vulnerability checks

---

## 3. Data Validation

Seed data must be validated before being inserted into IndexedDB.

Domain mutations should be validated using the project's runtime schemas.

Invalid data must not be silently persisted.

Where practical, persisted records should also be runtime-validated when read from local storage.

Stored browser data must never be assumed to be trustworthy solely because it was previously written by DealPatch.

---

## 4. Local Storage Model

DealPatch uses IndexedDB for local persistence.

IndexedDB must not be treated as secure storage.

Users may:

- inspect stored data
- modify stored data
- delete stored data
- clear browser storage
- lose stored data through browser eviction

DealPatch V1 therefore must not store:

- passwords
- access tokens
- API keys
- sensitive customer information
- authentication credentials
- private production data

IndexedDB provides persistence, not security or user isolation.

---

## 5. Authentication and Authorization

DealPatch V1 does not implement:

- authentication
- authorization
- users
- roles
- permissions
- multi-tenant isolation

Fields such as `ownerId` are demo-domain data only.

They must not be interpreted as security or access-control boundaries.

Authentication or authorization must not be added without an explicit product and architecture decision.

---

## 6. AI and External Services

DealPatch V1 does not send data to external AI services.

AI-style workflows are simulated locally.

The application must not introduce:

- OpenAI credentials
- Anthropic credentials
- third-party AI API keys
- hidden external AI requests

without an explicit product decision.

Any future external integration must document:

- what data leaves the browser
- where it is sent
- how credentials are stored
- what user consent is required
- what security controls are introduced

---

## 7. HTML and Content Rendering

User-controlled or data-driven text must be rendered as plain text by default.

Do not use:

`dangerouslySetInnerHTML`

unless there is a documented and reviewed requirement.

Evidence text, activity summaries, notes, and proposal content must never be interpreted as executable markup.

---

## 8. URL Handling

Any external URLs introduced in the future must be validated before use.

Do not allow arbitrary user-provided values to become:

- executable URLs
- navigation targets
- script sources
- iframe sources

Unsafe URL schemes such as `javascript:` must never be accepted.

---

## 9. Security Headers

DealPatch uses appropriate browser security headers where compatible with the application.

Current protections may include:

- `X-Content-Type-Options`
- frame protection
- referrer policy
- browser permissions restrictions
- opener isolation

Security headers must be reviewed whenever deployment behavior changes.

### Content Security Policy

A strict Content Security Policy is intentionally deferred until it can be implemented correctly with the current Next.js runtime.

Do not introduce a CSP that breaks framework behavior merely to satisfy a checklist.

### HSTS

HTTP Strict Transport Security is deployment-specific.

HSTS should only be introduced when the deployed application is consistently served over HTTPS.

---

## 10. Dependency Security

Dependency checks should be run regularly.

Recommended commands:

```bash
npm audit
npm audit --omit=dev
```

See the root [security policy](../SECURITY.md) for disclosure, supported scope and
current accepted dependency risks, and [release readiness](./RELEASE_READINESS.md)
for the latest validation results.
