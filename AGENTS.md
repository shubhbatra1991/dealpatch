# DealPatch Agent Instructions

DealPatch is an open-source, frontend-focused B2B sales workspace.

Before making changes, read:

1. docs/PRD.md
2. docs/ARCHITECTURE.md
3. docs/DESIGN_SYSTEM.md
4. docs/ENGINEERING_RULES.md
5. docs/SECURITY.md

## Core rules

- Do not introduce external APIs without explicit approval.
- Do not introduce `.env` requirements.
- Do not add authentication in V1.
- Do not add Supabase, Firebase, Prisma, or external databases.
- Keep business logic outside React components where practical.
- Keep route files small.
- Prefer feature-local components over global components.
- Do not add dependencies unless the task genuinely requires them.
- Maintain accessibility and keyboard navigation.
- Do not use `dangerouslySetInnerHTML`.
- Do not move to another milestone unless requested.
- Run lint, typecheck, tests, and build before considering a task complete.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
