# Activity workspace

Activity uses a searchable, newest-first feed beside the selected source and the
existing Demo intelligence panel. Panes stack below the desktop breakpoint. All
150 demo records are available in a bounded scroll region; no activity dropdown,
pagination or additional package is needed for this dataset.

Search matches partial case-insensitive terms across title, summary, type,
account and related deal. Exact type and account filters compose with search.
Account/deal/participant labels resolve from existing shared query caches, with
account boundaries checked before displaying related deals or participant names.
Missing references remain readable without broken navigation links.

Selection is local UI state. No activity is selected by default; existing
`/activity?activity=...` links select and focus that source without starting a run.
Filtering preserves the selected detail and explains when it is outside the
filtered feed. Arrow keys, J/K, Home/End and Enter support selection and detail
focus. The feed has one roving tab stop rather than 150 sequential tab stops.

Changing selection calls the existing analysis reset: abort the active controller,
clear draft/events and ignore late events from the previous run. Reselecting the
same activity keeps its analysis. Selection pauses only during an explicit queue
write so persistence errors and success remain associated with the correct source.
Route unmount also aborts the stream. No analysis runs automatically.

The existing provider emits the seven stages; waiting/running/complete/failed and
cancelled outcomes remain visible. Completed drafts show changes, confidence and
evidence. Send to Review Queue uses the existing validated, deduplicating proposal
repository mutation and cache invalidation. No CRM fields are applied by analysis
or by sending a proposal. No database migration or new dependency is required.
