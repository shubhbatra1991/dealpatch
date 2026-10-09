## ADR-001 — npm instead of pnpm

Status: Accepted

Decision:
DealPatch uses npm.

Reason:
npm minimizes contributor setup and is sufficient for the repository.

---

## ADR-002 — IndexedDB instead of external database

Status: Accepted

Decision:
V1 uses Dexie + IndexedDB.

Reason:
DealPatch must run locally without environment variables or external services.

---

## ADR-003 — Simulated intelligence instead of OpenAI API

Status: Accepted

Decision:
V1 uses a deterministic intelligence provider.

Reason:
The project exists to demonstrate interface architecture,
not external API integration.