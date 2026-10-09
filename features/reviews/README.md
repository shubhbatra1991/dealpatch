# Human-reviewed local updates

Review cards read the repository's live value projection through TanStack Query.
Selection is transient UI state. Approve all applies every unresolved field;
Approve selected applies only the selection, leaving skipped fields reviewable.
Partial approval stays PartiallyApproved, including after rejecting its remainder.
All field snapshots and decisions remain in the stored proposal.

Editing validates both the field schema and the target domain rules, writes only
the suggested after value, and appends a FieldEdited event in one transaction.
The optional edited flag preserves this provenance after approval/rejection and
requires no database migration or seed reset. Existing Edited records still work.
Proposed values use the target field's normalization (including string trimming)
so previews, persisted values and Undo receipts agree; before is never normalized
or replaced by the editor. A normalized no-op edit is rejected.

Approvals acquire the existing per-client review write lock, cancel reads and
optimistically patch entity lists, account contacts, the queue, proposal history,
and pending counts. The repository verifies the displayed proposal snapshot,
re-reads target values and checks immutable before snapshots in the same atomic
transaction as entity/proposal writes and audit appends. Terminal stages and
activity participant account ownership are validated. Failure rolls back only
affected cache fields, preserving unrelated edits, then invalidates shared caches.

Staleness is derived from current persisted values rather than adding an
undocumented Stale domain status. Cards label stale proposals/fields and show
captured, current and proposed values. A stale field is blocked even after editing
after; no force-apply or rebasing silently changes before. Refresh current values,
review again, and reject/regenerate stale suggestions. Valid unrelated selected
fields can still be approved.

Approval notifications show applied, skipped, rejected and edited fields. Completed
proposals remain in expandable review history after reload. Undo is session-only,
available through the approval notification until dismissed; it is not fabricated
after reload. Newer decisions disable older Undo actions until reversed in order.
The repository additionally refuses to overwrite later changes to approved fields.
Undo restores exactly the receipt's business fields and proposal/change state;
unrelated later edits remain. Account updatedAt records the new write time.

Audit history is append-only: approval/partial approval and Undo each append one
event per applied field, with target entity/type, proposal ID, previous/next field
values and occurredAt. Edit/reject events capture proposal state and target
identifiers without claiming the CRM data was changed. Audit failure aborts the
entire transaction. Account Changes tabs show this existing audit history.

Files for this milestone:
- Created: features/reviews/review-outcome.tsx, review-history.tsx, README.md.
- Updated: features/reviews/approval-mutations.ts, review-card.tsx,
  review-change.tsx, review-format.ts, review-notifications.tsx, review-workspace.tsx,
  use-review-card-actions.ts.
- Updated: lib/repositories/reviews.ts; domain/proposals/proposal-change.ts,
  schema.ts, review.ts; domain/audit/audit.types.ts, audit.schema.ts.
- Updated: features/accounts/account-detail-sections.tsx (partial audit label only),
  docs/DATA_MODEL.md, domain/README.md; tests/approval.test.ts, reviews.test.ts,
  account-detail.test.ts.

No new packages, storage stores, remote services or automatic CRM writes.
