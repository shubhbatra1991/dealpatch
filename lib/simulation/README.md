# Demo intelligence

`IntelligenceProvider.analyze(input, { signal })` returns an `AsyncIterable` of
typed events. `mockIntelligenceProvider` is entirely local: no network calls,
credentials, server endpoints or model SDKs. Importing it starts no work.

The mock delivers seven events, with the first emitted immediately and subsequent
events spaced by 650ms to demonstrate partial UI state. Event payloads contain
progressively available participants/phrase matches, account/deal matches, field
diffs, confidence and a validated draft proposal. Account and deal matching uses
existing relationship IDs, not semantic search. Source activity text is data only.

Supported exact demo phrases cover completed discovery, a 4 December close date
(using the source activity's year), a revised rollout plan/seat estimate and unresolved
budget approval. Rules only suggest changes to linked open deals, skip unchanged
values and attach verbatim source excerpts. The fixed 88% score is explicitly a
simulated score, not a calibrated probability. This is not general text understanding.

If no supported change exists, `analysis_completed` explains why and no proposal is
created. Cancellation uses `AbortSignal`, clears pending timers and throws `AbortError`.
The provider does not save proposals or update CRM fields.

`createMockIntelligenceProvider` accepts `stepDelayMs`, `now` and `createId` for fast,
deterministic tests. The normal application uses the staged delay; tests can use zero.
This timing controls event delivery only and does not claim to measure computation.

The Activity page consumes the stream through `useDemoAnalysis`, which guards stale
runs, aborts on activity change/unmount, retains cancelled/error partial output and
only exposes completed drafts for sending. Stream progress is transient React state;
Query owns repository data and the explicit queue mutation. The queue repository
rechecks source/relationships/current values and avoids identical pending proposals.
Saving suggestions does not apply CRM changes. Existing review approval/Undo remains
the only application flow.

Run `npm run test:simulation` for event order/payloads, generation, no-change results,
abort behavior, state transitions, queue validation/deduplication and SSR safety.
