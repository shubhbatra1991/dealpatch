# Review Queue

`ReviewWorkspace` renders repository-backed Query data at `/reviews`. Each proposal
shows account/deal context, the source activity, generation time in UTC, simulated
confidence, evidence and live current values alongside proposed values. Native
checkboxes select individual changes; inline editors save proposals without
applying CRM changes. All field values are validated against the domain schemas.

`lib/repositories/reviews.ts` owns the review transaction across proposals and CRM
tables. Approval checks account membership and compares the latest stored value
against the generation snapshot before applying each selected change. Any failure
rolls back the entire operation. A duplicate/concurrent approval cannot apply twice.
Stale or missing targets are displayed as conflicts and cannot be approved.
Rejection marks only unreviewed changes as rejected and never reverses prior approvals.

Partial approvals retain the proposal in the queue until every change is reviewed.
Completed mixed decisions retain `PartiallyApproved` in storage but leave the queue.
Approved/rejected field decisions remain in the proposal record. Inline edits use
`Edited` until approved. Selection is transient component state.

Query owns all data and mutations; repository writes invalidate proposal, deal and
account queries, including the real pending count in the sidebar. No external AI,
services, new dependencies, authentication or database migration are needed.

Review cards use semantic articles, headings, fieldsets, labelled native controls,
visible focus and live announcements. Tab/Shift+Tab follow document order; native
checkbox and button keyboard behavior works. Inline editing autofocuses its control;
Escape/Cancel returns focus to Edit. Completed decisions focus the queue heading
so focus is not lost when a card disappears.

Run `npm run test:reviews` for fake IndexedDB transaction, conflict, partial review,
validation, persistence, concurrency and semantic-rendering checks, plus optimistic
approval, partial approval, rollback and Undo. Proposal generation and durable history
remain separate milestones.

## Optimistic approval and Undo

`approval-mutations.ts` contains the TanStack Query mutation options and cache
projection. It cancels in-flight reads, captures the proposal/current review context,
patches cached deals/accounts, updates review diffs and the pending count immediately,
then commits the original atomic repository transaction. A failure restores the
affected fields and proposal, preserving unrelated cached edits. All review writes
share a small guard so overlapping optimistic patches cannot clobber each other.
Repository validation and stale-value checks remain authoritative. Settling either
approval or Undo invalidates affected queries for reconciliation with IndexedDB.

The shell's `ReviewNotifications` observes the Query mutation cache, so saving,
success/failure feedback and Undo survive navigation and removal of a review card.
Success is announced after persistence commits; the saving notification appears
immediately. Toasts remain until dismissed. Undo is offered after a successful commit
and lasts for this session until dismissal/reload; receipts are held only in the
Query mutation cache, not in a new database table or Zustand store.

The repository captures authoritative before/after proposal states in an approval
receipt. Undo atomically restores only fields approved by that operation and the
exact original proposal, including edited suggestions and earlier partial decisions.
It preserves unrelated CRM edits. If an approved field or proposal was changed
later, Undo refuses to overwrite the newer data. Multiple approvals on one proposal
must be undone in reverse order. Failed Undo reverts its optimistic cache restoration,
reports the failure and leaves Undo available for retry.

`use-review-card-actions.ts` owns action orchestration; presentation components only
render state and invoke handlers. No timers or artificial persistence delays are
added to the application. Tests use deferred persistence to inspect cache changes
before commit and to exercise deterministic failure paths.
