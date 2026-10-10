# Security policy

DealPatch is an educational, local-first workspace, not a production CRM service.
Use fictional data only; never store real customer or sensitive personal data.
No API keys, credentials, or environment variables are required.

## Local storage

IndexedDB provides browser-local persistence, not secure storage, access control,
or a backup. Same-origin scripts, browser tools, and privileged extensions may
read or modify it. Clearing browser storage can remove workspace data.

## Reporting vulnerabilities

Use **Security → Report a vulnerability** on GitHub if available. Otherwise,
[open a minimal issue](https://github.com/shubhbatra1991/dealpatch/issues) requesting
a private reporting channel. Do not publish exploit details, credentials, or
personal data. Share the affected commit, impact, and safe reproduction steps
through the private channel. No response-time guarantee is provided.

## Dependency and security monitoring

The repository includes Dependabot update configuration, CodeQL, and CI checks.
Use `npm audit` to review current dependency advisories. Repository administrators
must verify GitHub security settings; configuration files alone do not enable
alerts, secret scanning, or push protection. Passing checks do not guarantee security.

## Public repository boundary

Everything committed here, including Git history and screenshots, is public.
Never commit API keys, credentials, signing keys, production secrets, private
infrastructure configuration, or real customer data. Keep private infrastructure
outside this repository. Future production secrets belong in deployment-platform
settings, such as Vercel environment variables, and must never reach browser bundles.

If a credential is exposed, revoke or rotate it immediately. Deleting a file does
not remove it from Git history or invalidate the credential.
