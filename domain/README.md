# Domain contract

`docs/DATA_MODEL.md` is the source of truth. Existing filenames and imports are
preserved; the domain depends only on TypeScript and Zod, never application frameworks.

- Accounts own contacts, deals and activities through opaque string IDs. A proposal
  references its account, optional deal, and source activity. Participant IDs refer
  to contacts. Audit events reference a target entity and an optional proposal.
- Only Account has `createdAt`/`updatedAt`; Activity has `occurredAt`, Proposal has
  `createdAt`, and AuditEvent has `occurredAt`, as specified. Extra timestamps are
  not invented for Contact or Deal. Monetary values remain unformatted numbers.
- Schema enum values are machine values, e.g. `ClosedWon`; labels such as
  “Closed Won” remain presentation concerns. No User or permission model is implied
  by ownerId. IDs have no required prefixes.
- Existing strict entity schemas validate current import/mutation boundaries.
  Cross-record existence, same-account ownership, and transactional write safety
  require current records and are not guaranteed by a single-record schema.
- `ProposalChange` correlates entity, field and value types; identity/relationship
  fields and Account's managed timestamps are not editable. Optional field absence
  is represented by null in changes. `before` is a readonly generation snapshot,
  including participant arrays; editors modify `after` without refreshing `before`.
  `isProposalChangeStale` and `assertProposalChangeCurrent` compare fresh current
  data against the snapshot. High confidence never bypasses review or this check.
- `assertDealStageTransition` prohibits leaving either terminal stage. A record
  schema cannot validate a transition without its previous state.
- AuditEvent is readonly, and its schema freezes the parsed top-level record.
  Snapshots validate as JSON data (null for absence). These domain protections
  are not tamper-proof storage or deep runtime freezing: audit persistence must
  enforce append-only writes and create another event on Undo. There are no audit
  mutation methods on the read-only audit repository; review writes append inside their
  owning IndexedDB transaction.

## Specification gaps and existing differences

- The document names ContactStatus without listing values. Existing Active/Inactive
  values are retained.
- AuditAction follows PascalCase conventions. ProposalPartiallyApproved now
  distinguishes partial decisions from ProposalApproved; ProposalRejected,
  FieldEdited and ApprovalUndone retain their existing meanings. The data model
  documents these actions and the optional persisted change.edited provenance flag.
- Audit entityType remains an open nonempty string, matching its declared type;
  previousValue/nextValue are unknown statically and restricted to JSON at runtime.
- The document says ProposalChange field values are unknown; the implementation
  intentionally offers stronger field-correlated types and excludes identity edits.
- The existing import schemas additionally require integer employee counts,
  HTTP(S) websites, valid email addresses, nonempty evidence, and nonempty changes.
  They do not infer a complete ISO currency registry from a three-letter code.
- Persistence lives outside the domain. Review transactions use the domain stage
  and stale-value guards, validate target records and append audit facts atomically.
  Undo may reverse the exact stage transition made by its approval receipt, while
  normal proposal edits cannot reopen terminal deals. No seed reset is needed for
  the optional edited flag or additional audit action.
